import { MATCH_STATUS } from "../validation/matches";
import { Match } from "@/types";



/**
 * Determines the current status of a match based on its start and end times.
 * @param startTime - ISO string representing the match start time
 * @param endTime - ISO string representing the match end time
 * @param now - Current time (defaults to now)
 * @returns The match status constant or null if dates are invalid
 */
export function getMatchStatus(startTime: string, endTime: string, now: Date = new Date()) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
    }

    if (now < start) {
        return MATCH_STATUS.SCHEDULED;
    }

    if (now >= end) {
        return MATCH_STATUS.FINISHED;
    }

    return MATCH_STATUS.LIVE;
}

/**
 * Synchronises a match's stored status with the computed status.
 * @param match - Match object adhering to the Match interface
 * @param updateStatus - Async callback to persist the new status
 * @returns The possibly updated status of the match
 */
export async function syncMatchStatus(match: Match, updateStatus: (status: typeof MATCH_STATUS[keyof typeof MATCH_STATUS]) => Promise<void>) {
    const nextStatus = getMatchStatus(match.startTime, match.endTime);
    if (!nextStatus) {
        return match.status;
    }
    if (match.status !== nextStatus) {
        await updateStatus(nextStatus);
        match.status = nextStatus;
    }
    return match.status;
}