// @ts-nocheck
import { executablePath } from "puppeteer";
import { MeetingResult, NotulenConfig, NotulenInterface, Transribe } from "./interfaces";
import { launch, getStream, getStreamOptions, wss } from "puppeteer-stream";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer-core";
import { Selector } from "./selector";
import { whenSubtitleOn } from "./external";
import EventEmitter from "events";
import { transribeToText } from "./helpers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { existsSync, mkdirSync } from "fs";
import { Transform } from "stream";
import { exec } from "child_process";
import ffmpegPath from "ffmpeg-static";
import pino from "pino";
import pinoPretty from "pino-pretty";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const logger = pino({
  transport: {
    target: "pino-pretty"
  }
});

const defaultStreamOptions: Partial<getStreamOptions> = {
  audio: true,
  video: true,
  videoConstraints: {
    mandatory: {
      width: { max: 1280 },
      height: { max: 720 },
      frameRate: { max: 15 }
    }
  }
};

export enum RecordingStatus {
  NOT_STARTED = "not_started",
  STARTED = "started",
  PAUSED = "paused",
  STOPPED = "stopped"
}

export class Notulen extends EventEmitter implements NotulenInterface {
  private browser: Browser;
  private page: Page;
  private config: NotulenConfig;
  private transcribe: Transribe[] = [];
  private videoOutput: string;
  private videoFileStream: any;
  private meetingTitle: string;
  private recordingStatus: RecordingStatus = RecordingStatus.NOT_STARTED;

  // video stream can be public
  private videoStream: Transform;

  constructor(config: NotulenConfig) {
    super();
    // check if the prompt is not provided
    if (!config.prompt) {
      config.prompt = `You are an Assistant Note Taker, based on the meeting results in the form of the transcript below, please make a summary of the meeting\n`;
    }

    // check if the recording location is not provided
    if (!config.recordingLocation) {
      config.recordingLocation = "./";
    } else {
      // check if recordingLocation is existing and create it otherwise

      if (!existsSync(config.recordingLocation)) {
        mkdirSync(config.recordingLocation);
      }
    }

    // cleanup double slashs
    this.videoOutput = `${config.recordingLocation}/meeting-${Date.now()}.mp4`.replace(
      /([^:])(\/\/+)/g,
      "$1/"
    );

    // merge the streamConfig
    config.streamConfig = {
      ...defaultStreamOptions,
      ...config.streamConfig
    };

    // default recordMeeting is true
    if (config.recordMeeting === undefined) {
      config.recordMeeting = true;
    }

    this.config = config;
  }

  private async setUp() {
    const puppeteer = require("puppeteer-extra");
    const stealthPlugin = StealthPlugin();
    stealthPlugin.enabledEvasions.delete("iframe.contentWindow");
    stealthPlugin.enabledEvasions.delete("media.codecs");
    puppeteer.use(stealthPlugin);
    // setup puppeteer
    this.browser = await launch(puppeteer, {
      args: ["--lang=en-US"],
      headless: this.config.debug ? false : ("new" as any),
      executablePath: executablePath()
    });

    logger.info("Browser has been started");

    this.page = await this.browser.newPage();

    // start video steam if recordMeeting is true
    if (this.config.recordMeeting) {
      this.videoFileStream = exec(`${ffmpegPath} -y -i - -c:v copy -c:a copy ${this.videoOutput}`);

      logger.info("Video stream has been started");
    }
  }

  public async listen(): Promise<void> {
    await this.setUp();

    await this.page.goto(this.config.googleMeetUrl);

    logger.info("Google Meet has been opened on the link %s", this.config.googleMeetUrl);

    // Waiting for input email appear
    const nameInput = await this.page.waitForSelector(Selector.INPUT_NAME, {
      visible: true,
      timeout: 0
    });
    await nameInput.focus();
    await this.page.keyboard.type(this.config.name);
    await this.page.keyboard.press("Enter");

    logger.info("Name has been inputted");

    // Waiting for join button appear and click
    // do not throw error if the selector is not found
    logger.info("Waiting for cancel allow mic button");
    await this.waitSelector(Selector.JOIN_BUTTON, {
      timeout: 2_000, // 2s
      cb: async () => {
        logger.info("Cancel allow mic button has been clicked");
        // Check if selector exists and click it if exists
        await this.page.click(Selector.CANCEL_ALLOW_MIC);
      }
    });

    // Waiting for Meeting has been started
    logger.info("Waiting for meeting has been started");
    await this.page.waitForSelector(Selector.BUTTON_END_CALL, {
      timeout: 0,
      visible: true
    });

    logger.info("Meeting has been started");

    // Start recording
    logger.info("Start recording");
    this.videoStream = await getStream(this.page, this.config.streamConfig);

    // Start the video status
    this.recordingStatus = RecordingStatus.STARTED;

    if (this.config.recordMeeting) {
      this.videoStream.on("close", () => {
        this.videoFileStream.stdin.end();
      });
      this.videoStream.pipe(this.videoFileStream.stdin);
    }

    logger.info("Keep you safe button checking ...");
    await this.waitSelector(Selector.MEET_KEEP_YOU_SAFE, {
      timeout: 2_000, // 2s
      cb: async () => {
        logger.info("Keep you safe button exist and will click it");
        // Check if selector exists and click it if exists
        await this.page.click(Selector.MEET_KEEP_YOU_SAFE_BUTTON);
      }
    });

    // Enable to transribe
    logger.info("Enable transribe");
    const transribe = await this.page.waitForSelector(Selector.ENABLE_TRANSRIBE_BUTTON, {
      timeout: 0
    });
    await transribe.click();
    logger.info("Transribe has been enabled");

    // change transribe language
    logger.info("Change transribe language to %s", this.config.language);
    // const settingButton = await this.page.waitForSelector(
    //   Selector.CAPTION_SETTING,
    //   {
    //     visible: true,
    //     timeout: 0,
    //   }
    // );
    // await settingButton.click();
    // await this.page.waitForSelector(Selector.TRANSRIBE_SETTING_CONTAINER);
    // const t = await this.page.waitForSelector(
    //   Selector.TRANSRIBE_SETTING_BUTTON
    // );
    // await t.evaluate((b) => b.click());
    // const langId = await this.page.waitForSelector(
    //   `li[data-value="${this.config.language}"`
    // );
    // await langId.evaluate((b) => b.click());
    // // wait for 1s using promise
    // await new Promise((r) => setTimeout(r, 1000));
    // const closeBtn = await this.page.waitForSelector(
    //   Selector.TRANSRIBE_SETTING_CLOSE_BUTTON
    // );
    // await closeBtn.click();
    logger.info("Transribe language has been changed to %s", this.config.language);

    // Check if the participants goes to zero
    await this.page.exposeFunction("onParticipantChange", async (current: string) => {
      // Trigger to stop the meeting
      await this.stop();
      logger.info("Participants has been changed to %s", current);
    });

    function onParticipantChange(current: string) {
      // Just for ignoring TS error
    }

    // Add transribe function
    this.listenForTransribe();

    // Listen for the meeting to end (by checking if the participant has left the meeting)
    await this.page.evaluate(() => {
      const target = document.querySelector("div[class='uGOf1d']");
      setInterval(() => {
        const currentParticipants = target?.textContent;
        if (currentParticipants === "1") {
          onParticipantChange(currentParticipants);
        }
      }, 1000);
    });

    // Set the meeting title
    const meetingTitle = await this.page.waitForSelector(Selector.MEETING_TITLE);
    this.meetingTitle = await meetingTitle.evaluate((el) => el.textContent);

    // Listen if the bot has been kicked from the meeting
    // Remove for now since the timeout is not working
    await this.page.evaluate(() => {
      setInterval(() => {
        const target = document.querySelector("h1[jsname='r4nke']");
        // Check if target was exists
        console.log("Checking", target);
        if (target) {
          onParticipantChange("0");
        }
      }, 1000);
    });
  }

  private async listenForTransribe() {
    try {
      logger.info("Starting listenForTransribe setup");

      // Try the DOM-based approach first
      logger.info("Setting up setTransribe function");
      await this.page.exposeFunction("setTransribe", (scripts: any[], lastSpeaker: string) => {
        logger.info(
          "setTransribe called with %d scripts, last speaker: %s",
          scripts.length,
          lastSpeaker
        );
        logger.info("--- Start of scripts ---");
        logger.info("scripts:", scripts);
        logger.info("--- End of scripts ---");
        this.transcribe = scripts;
      });

      logger.info("Evaluating whenSubtitleOn function");
      await this.page.evaluate(whenSubtitleOn);
      logger.info("whenSubtitleOn function evaluated successfully");

      // Add WebRTC-based transcription as backup
      logger.info("Setting up WebRTC speech recognition backup");
      try {
        await this.page.evaluate(() => {
          console.log("[Debug] Setting up speech recognition");
          const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = document.documentElement.lang || "en-US";
          console.log("[Debug] Speech recognition configured with language:", recognition.lang);

          recognition.onstart = () => {
            console.log("[Debug] Speech recognition started");
          };

          recognition.onerror = (event) => {
            console.error("[Debug] Speech recognition error:", event.error);
          };

          recognition.onend = () => {
            console.log("[Debug] Speech recognition ended");
          };

          recognition.onresult = function (event) {
            console.log("[Debug] Speech recognition got result");
            const transcript = Array.from(event.results)
              .map((result) => result[0].transcript)
              .join(" ");

            console.log("[Debug] Transcript:", transcript);

            const transribe = {
              speaker: {
                name: "Speaker", // We can't determine speaker from audio
                profilePicture: ""
              },
              text: transcript,
              date: Date.now()
            };

            // Use window.setTransribe to access the exposed function
            try {
              (window as any).setTransribe([transribe], "Speaker");
              console.log("[Debug] Successfully sent transcript to setTransribe");
            } catch (error) {
              console.error("[Debug] Failed to call setTransribe:", error);
            }
          };

          recognition.start();
        });
        logger.info("WebRTC speech recognition setup completed");
      } catch (error) {
        logger.error("Failed to setup WebRTC speech recognition:", error);
      }
    } catch (error) {
      logger.error("Failed to setup transcription:", error);
    }
  }

  private async waitSelector(
    selector: string,
    { timeout = 0, cb }: { timeout?: number; cb?: Function } = {}
  ): Promise<void> {
    try {
      await this.page.waitForSelector(selector, {
        timeout,
        visible: true
      });
      await cb();
    } catch (error) {
      // TODO: Handle the errorF
    }
  }

  public async stop(): Promise<void> {
    // Skip if the recording has been stopped
    if (this.recordingStatus === RecordingStatus.STOPPED) {
      return;
    }

    // Stop the recording
    this.recordingStatus = RecordingStatus.STOPPED;

    // Stop File and video streaming
    await this.videoStream.destroy();

    // Stop WSS
    (await wss).close();

    // Convert the transribe to summary
    logger.info("--- Start of transribe ---");
    logger.info("transribe:", this.transcribe);
    logger.info("--- End of transribe ---");
    const transcribe = transribeToText(this.transcribe);

    const meetingResult: MeetingResult = {
      title: this.meetingTitle,
      googleMeetLink: this.config.googleMeetUrl,
      recordingLocation: this.videoOutput,
      transribe: this.transcribe,
    };

    await this.browser.close();

    // Emit the end event
    this.emit("end", meetingResult);
  }
}
