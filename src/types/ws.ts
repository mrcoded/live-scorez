import { Match, Commentary } from "@/types";

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

/**
 * Payload sent when a client successfully subscribes to a match.
 */
export interface SubscribedPayload extends WSMessageBase {
  type: "subscribed";
  matchId: number;
}

/**
 * Payload sent when a client successfully unsubscribes from a match.
 */
export interface UnsubscribedPayload extends WSMessageBase {
  type: "unsubscribed";
  matchId: number;
}

/**
 * Payload for commentary events sent to subscribed clients.
 */
export interface CommentaryPayload extends WSMessageBase {
  type: "commentary";
  data: Commentary;
}

/**
 * Payload for sending error details to a client.
 */
export interface ErrorPayload extends WSMessageBase {
  type: "error";
  message: string;
}

// Union of all possible WebSocket messages used in this app.
export type WSMessage =
  | MatchCreatedPayload
  | WelcomePayload
  | SubscribedPayload
  | UnsubscribedPayload
  | CommentaryPayload
  | ErrorPayload;
