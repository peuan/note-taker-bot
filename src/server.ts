import express from "express";
import path from "path";
import bodyParser from "body-parser";
import { Notulen } from "./index"; // Adjust the path as necessary
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public")); // Serve static files from the public directory
app.use(morgan("combined")); // HTTP request logger

// Serve the HTML form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Handle form submission
app.post("/submit", async (req, res) => {
  const { name, googleMeetUrl, language, geminiApiKey, debug, recordMeeting } =
    req.body;

  try {
    const client = new Notulen({
      name,
      googleMeetUrl,
      language,
      geminiApiKey,
      debug: debug === "on",
      recordMeeting: recordMeeting === "on",
      streamConfig: {
        audio: true,
        video: true,
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
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

    client.on("end", (result) => {
      console.log("Transribe:");
      console.log(result.transribe);
      console.log("Summary:");
      console.log(result.summary);
    });
    res.send("Notulen instance created and listening!");
  } catch (error) {
    console.error("Error creating Notulen instance:", error);
    res.status(500).send("Error creating Notulen instance");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
