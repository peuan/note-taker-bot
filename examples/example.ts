import { Notulen } from "../src";
import { MeetingResult } from "../src/interfaces";

async function main() {
  const client = new Notulen({
    name: "First's Doppleganger",
    googleMeetUrl: "https://meet.google.com/bms-syxs-cdv",
    language: "en-US",
    geminiApiKey: "AIzaSyCLgWEndtamiR7Dusgx9K-7OGEXcxG2QLY",
    debug: true,
    recordMeeting: true,
    streamConfig: {
      audio: true,
      video: true,
      audioBitsPerSecond: 128000, // 128kbps
      videoBitsPerSecond: 2500000, // 2.5Mbps
      videoConstraints: {
        mandatory: {
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 15 },
        },
      },
    },
  });

  await client.listen();

  client.on("end", (result: MeetingResult) => {
    console.log("Transribe:");
    console.log(result.transribe);
    console.log("Summary:");
    console.log(result.summary);
  });
}

main();
