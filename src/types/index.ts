import { MATCH_STATUS } from "@/validation/matches";

// Interface representing a Match entity used throughout the application
export interface Match {
    id: number;
    sport: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string; // ISO date string
    endTime: string; // ISO date string
    status: typeof MATCH_STATUS[keyof typeof MATCH_STATUS]
    homeScore: number;
    awayScore: number;
}

// Interface representing a Commentary entity used throughout the application
export interface Commentary {
    id: number;
    matchId: number;
    minutes: number;
    sequence: number;
    period: string;
    eventType: string;
    actor: string | null;
    team: string | null;
    message: string;
    metadata: Record<string, unknown> | null;
    tags: string[] | null;
    createdAt: string; // ISO timestamp string or Date object
}