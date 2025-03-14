import { Participant } from "./participant";

export interface MeetingResult {
  title: string;
  // TODO: Implement later
  // participants: Participant[];
  googleMeetLink: string;
  recordingLocation: string;
  transribe: string;
  transcript?: string;
  summary?: string;
}
