import { Match } from "@/types";

/**
 * Base interface for all WebSocket messages.
 */
export interface WSMessageBase {
  type: string;
}

/**
 * Payload for match.created events broadcasted over WebSocket.
 */
export interface MatchCreatedPayload extends WSMessageBase {
  type: "match.created";
  data: Match;
}

/**
 * Payload for welcome messages sent to newly connected clients.
 */
export interface WelcomePayload extends WSMessageBase {
  type: "welcome";
}

// Union of all possible WebSocket messages used in this app.
export type WSMessage = MatchCreatedPayload | WelcomePayload;


