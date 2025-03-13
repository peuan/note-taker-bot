# Notulen

Notulen is a simple Google Meet note-taking application that utilizes AI transcription to generate meeting summaries. It captures audio and video streams from Google Meet and transcribes the conversation in real-time.

## Features

- Record Google Meet sessions with audio and video.
- Real-time transcription of conversations.
- Generate summaries of meetings using AI.
- Configurable settings for recording and transcription.

## Table of Contents

- [Notulen](#notulen)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Configuration](#configuration)
  - [Scripts](#scripts)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/notulen.git
   cd notulen
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. (Optional) Install Chrome for Puppeteer:

   ```bash
   npm install chrome
   ```

## Usage

1. Create a `.env` file in the root directory and add your Google Gemini API key:

   ```
   GEMINI_API_KEY=your_api_key_here
   PORT=3000
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000` to access the Notulen configuration form.

4. Fill in the required fields and submit the form to start recording and transcribing your Google Meet session.

## Configuration

The application can be configured using the following parameters:

- **name**: The name to be used in the Google Meet session.
- **googleMeetUrl**: The URL of the Google Meet session.
- **language**: The language for transcription (e.g., `en-US`).
- **geminiApiKey**: Your Gemini API key for AI transcription.
- **debug**: Set to `true` to enable debug mode.
- **recordMeeting**: Set to `true` to record the meeting.
- **streamConfig**: Configuration for audio and video streams.

## Scripts

- `npm run clean`: Remove the `dist` directory.
- `npm run build`: Build the TypeScript files.
- `npm run watch`: Start watching for changes in TypeScript files.
- `npm run start`: Start the server.
