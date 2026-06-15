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