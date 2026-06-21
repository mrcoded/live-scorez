import "dotenv/config";
import fs from "fs/promises";
import path from "path";

const DELAY_MS = Number.parseInt(process.env.DELAY_MS || "250", 10);
const NEW_MATCH_DELAY_MIN_MS = 2000;
const NEW_MATCH_DELAY_MAX_MS = 3000;
const DEFAULT_MATCH_DURATION_MINUTES = Number.parseInt(
    process.env.SEED_MATCH_DURATION_MINUTES || "120",
    10,
);
const FORCE_LIVE =
    process.env.SEED_FORCE_LIVE !== "0" &&
    process.env.SEED_FORCE_LIVE !== "false";
const API_URL = process.env.API_URL;
if (!API_URL) {
    throw new Error("API_URL is required to seed via REST endpoints.");
}

// CJS compatible path resolution
const DEFAULT_DATA_FILE = path.join(process.cwd(), "src/data/data.json");

interface SeedMatch {
    id?: number;
    sport: string;
    homeTeam: string;
    awayTeam: string;
    startTime?: string;
    endTime?: string;
    homeScore?: number;
    awayScore?: number;
}

interface CommentaryEntry {
    matchId?: number;
    minute?: number;
    minutes?: number;
    sequence?: number;
    period?: string;
    eventType?: string;
    actor?: string | null;
    team?: string | null;
    message?: string;
    metadata?: Record<string, unknown> | null;
    tags?: string[] | null;
}

interface Match {
    id: number;
    sport: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    endTime: string;
    homeScore: number;
    awayScore: number;
}

interface MatchState {
    match: Match;
    score: { home: number; away: number };
    fakeNext: "home" | "away";
}

async function readJsonFile(filePath: string): Promise<any> {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function loadSeedData(): Promise<{ feed: CommentaryEntry[]; matches: SeedMatch[] }> {
    const parsed = await readJsonFile(DEFAULT_DATA_FILE);

    if (Array.isArray(parsed)) {
        return { feed: parsed, matches: [] };
    }

    if (Array.isArray(parsed.commentary)) {
        return { feed: parsed.commentary, matches: parsed.matches ?? [] };
    }

    if (Array.isArray(parsed.feed)) {
        return { feed: parsed.feed, matches: parsed.matches ?? [] };
    }

    throw new Error(
        "Seed data must be an array or contain a commentary/feed array.",
    );
}

async function fetchMatches(limit = 100): Promise<Match[]> {
    const response = await fetch(`${API_URL}/api/matches?limit=${limit}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch matches: ${response.status}`);
    }
    const payload = await response.json() as { data: unknown };
    return Array.isArray(payload.data) ? (payload.data as Match[]) : [];
}

function parseDate(value: string | undefined): Date | null {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function isLiveMatch(match: Match): boolean {
    const start = parseDate(match.startTime);
    const end = parseDate(match.endTime);
    if (!start || !end) {
        return false;
    }
    const now = new Date();
    return now >= start && now < end;
}

function buildMatchTimes(seedMatch: SeedMatch): { startTime: string; endTime: string } {
    const now = new Date();
    const durationMs = DEFAULT_MATCH_DURATION_MINUTES * 60 * 1000;

    let start = parseDate(seedMatch.startTime);
    let end = parseDate(seedMatch.endTime);

    if (!start && !end) {
        start = new Date(now.getTime() - 5 * 60 * 1000);
        end = new Date(start.getTime() + durationMs);
    } else {
        if (start && !end) {
            end = new Date(start.getTime() + durationMs);
        }
        if (!start && end) {
            start = new Date(end.getTime() - durationMs);
        }
    }

    if (FORCE_LIVE && start && end) {
        if (!(now >= start && now < end)) {
            start = new Date(now.getTime() - 5 * 60 * 1000);
            end = new Date(start.getTime() + durationMs);
        }
    }

    if (!start || !end) {
        throw new Error("Seed match must include valid startTime and endTime.");
    }

    return {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
    };
}

async function createMatch(seedMatch: SeedMatch): Promise<Match> {
    const { startTime, endTime } = buildMatchTimes(seedMatch);

    const response = await fetch(`${API_URL}/api/matches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            sport: seedMatch.sport,
            homeTeam: seedMatch.homeTeam,
            awayTeam: seedMatch.awayTeam,
            startTime,
            endTime,
            homeScore: seedMatch.homeScore ?? 0,
            awayScore: seedMatch.awayScore ?? 0,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to create match: ${response.status}`);
    }
    const responsePayload = await response.json() as { data: Match };
    return responsePayload.data;
}

async function insertCommentary(matchId: number, entry: CommentaryEntry): Promise<any> {
    const payload: Record<string, any> = {
        message: entry.message ?? "Update",
    };

    // Map minute -> minutes for the route validator
    const targetMin = entry.minutes ?? entry.minute;
    if (targetMin !== undefined && targetMin !== null) {
        payload.minutes = targetMin;
    }
    if (entry.sequence !== undefined && entry.sequence !== null) {
        payload.sequence = entry.sequence;
    }
    if (entry.period !== undefined && entry.period !== null) {
        payload.period = entry.period;
    }
    if (entry.eventType !== undefined && entry.eventType !== null) {
        payload.eventType = entry.eventType;
    }
    if (entry.actor !== undefined && entry.actor !== null) {
        payload.actor = entry.actor;
    }
    if (entry.team !== undefined && entry.team !== null) {
        payload.team = entry.team;
    }
    if (entry.metadata !== undefined && entry.metadata !== null) {
        payload.metadata = entry.metadata;
    }
    if (entry.tags !== undefined && entry.tags !== null) {
        payload.tags = entry.tags;
    }

    const response = await fetch(`${API_URL}/api/matches/${matchId}/commentary`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Failed to create commentary: ${response.status}`);
    }
    const responsePayload = await response.json() as { data: any };
    return responsePayload.data;
}

function inningsRank(period: string | undefined): number {
    if (!period) {
        return 0;
    }
    const lower = String(period).toLowerCase();
    const match = lower.match(/(\d+)(st|nd|rd|th)/);
    if (match) {
        return Number(match[1]) || 0;
    }
    if (lower.includes("first")) {
        return 1;
    }
    if (lower.includes("second")) {
        return 2;
    }
    if (lower.includes("third")) {
        return 3;
    }
    if (lower.includes("fourth")) {
        return 4;
    }
    return 0;
}

function normalizeCricketFeed(entries: CommentaryEntry[], match: Match): CommentaryEntry[] {
    const sorted = [...entries].sort((a, b) => {
        const inningsDiff = inningsRank(a.period) - inningsRank(b.period);
        if (inningsDiff !== 0) {
            return inningsDiff;
        }
        const seqA = Number.isFinite(a.sequence)
            ? (a.sequence as number)
            : Number.MAX_SAFE_INTEGER;
        const seqB = Number.isFinite(b.sequence)
            ? (b.sequence as number)
            : Number.MAX_SAFE_INTEGER;
        if (seqA !== seqB) {
            return seqA - seqB;
        }
        const minA = Number.isFinite(a.minutes ?? a.minute) ? ((a.minutes ?? a.minute) as number) : Number.MAX_SAFE_INTEGER;
        const minB = Number.isFinite(b.minutes ?? b.minute) ? ((b.minutes ?? b.minute) as number) : Number.MAX_SAFE_INTEGER;
        return minA - minB;
    });

    const grouped = new Map<number, CommentaryEntry[]>();
    for (const entry of sorted) {
        const key = inningsRank(entry.period);
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(entry);
    }

    const ordered: CommentaryEntry[] = [];
    const inningsKeys = Array.from(grouped.keys()).sort((a, b) => a - b);

    for (const key of inningsKeys) {
        const inningsEntries = grouped.get(key) || [];
        const primaryTeam = inningsEntries.find(
            (entry) => entry.team === match.homeTeam || entry.team === match.awayTeam,
        )?.team;
        const secondaryTeam =
            primaryTeam === match.homeTeam ? match.awayTeam : match.homeTeam;

        const neutral = inningsEntries.filter(
            (entry) => !entry.team || entry.team === "neutral",
        );
        const primary = inningsEntries.filter(
            (entry) => entry.team === primaryTeam,
        );
        const secondary = inningsEntries.filter(
            (entry) => entry.team === secondaryTeam,
        );
        const other = inningsEntries.filter(
            (entry) =>
                entry.team &&
                entry.team !== "neutral" &&
                entry.team !== primaryTeam &&
                entry.team !== secondaryTeam,
        );

        ordered.push(...neutral, ...primary, ...secondary, ...other);
    }

    return ordered;
}

function replaceTrailingTeam(message: string | undefined, replacements: Map<string, string>): string | undefined {
    if (typeof message !== "string") {
        return message;
    }
    const match = message.match(/\(([^)]+)\)\s*$/);
    if (!match) {
        return message;
    }
    const nextTeam = replacements.get(match[1]);
    if (!nextTeam) {
        return message;
    }
    return message.replace(/\([^)]+\)\s*$/, `(${nextTeam})`);
}

function cloneCommentaryEntries(entries: CommentaryEntry[], templateMatch: SeedMatch, targetMatch: Match): CommentaryEntry[] {
    const replacements = new Map<string, string>([
        [templateMatch.homeTeam, targetMatch.homeTeam],
        [templateMatch.awayTeam, targetMatch.awayTeam],
    ]);

    return entries.map((entry) => {
        const next = { ...entry, matchId: targetMatch.id };
        if (entry.team === templateMatch.homeTeam) {
            next.team = targetMatch.homeTeam;
        } else if (entry.team === templateMatch.awayTeam) {
            next.team = targetMatch.awayTeam;
        }
        next.message = replaceTrailingTeam(entry.message, replacements);
        return next;
    });
}

function expandFeedForMatches(feed: CommentaryEntry[], seedMatches: SeedMatch[]): CommentaryEntry[] {
    if (!Array.isArray(seedMatches) || seedMatches.length === 0) {
        return feed;
    }

    const byMatchId = new Map<number, CommentaryEntry[]>();
    for (const entry of feed) {
        if (!Number.isInteger(entry.matchId)) {
            continue;
        }
        const mId = entry.matchId as number;
        if (!byMatchId.has(mId)) {
            byMatchId.set(mId, []);
        }
        byMatchId.get(mId)!.push(entry);
    }

    const matchById = new Map<number, SeedMatch>();
    const templateBySport = new Map<string, SeedMatch>();
    for (const match of seedMatches) {
        if (Number.isInteger(match.id)) {
            matchById.set(match.id as number, match);
            if (!templateBySport.has(match.sport) && byMatchId.has(match.id as number)) {
                templateBySport.set(match.sport, match);
            }
        }
    }

    const expanded = [...feed];
    for (const match of seedMatches) {
        if (!Number.isInteger(match.id)) {
            continue;
        }
        const mId = match.id as number;
        if (byMatchId.has(mId)) {
            continue;
        }
        const templateMatch = templateBySport.get(match.sport);
        if (!templateMatch || !Number.isInteger(templateMatch.id)) {
            continue;
        }
        const templateEntries = byMatchId.get(templateMatch.id as number) || [];
        expanded.push(
            ...cloneCommentaryEntries(templateEntries, templateMatch, match as Match),
        );
    }

    return expanded;
}

function buildRandomizedFeed(feed: CommentaryEntry[], matchMap: Map<number, MatchState>): CommentaryEntry[] {
    const buckets = new Map<number | null, CommentaryEntry[]>();
    for (const entry of feed) {
        const key = Number.isInteger(entry.matchId) ? (entry.matchId as number) : null;
        if (!buckets.has(key)) {
            buckets.set(key, []);
        }
        buckets.get(key)!.push(entry);
    }

    for (const [matchId, entries] of buckets) {
        if (!Number.isInteger(matchId)) {
            continue;
        }
        const mId = matchId as number;
        const target = matchMap.get(mId);
        const sport = target?.match?.sport?.toLowerCase();
        if (sport === "cricket" && target?.match) {
            buckets.set(mId, normalizeCricketFeed(entries, target.match));
        }
    }

    const matchIds = Array.from(buckets.keys());
    const randomized: CommentaryEntry[] = [];
    let lastMatchId: number | null = null;

    while (randomized.length < feed.length) {
        const candidates = matchIds.filter(
            (id) => (buckets.get(id) || []).length > 0,
        );
        if (candidates.length === 0) {
            break;
        }

        let selectable = candidates;
        if (lastMatchId !== null && candidates.length > 1) {
            const withoutLast = candidates.filter((id) => id !== lastMatchId);
            if (withoutLast.length > 0) {
                selectable = withoutLast;
            }
        }

        const choice = selectable[Math.floor(Math.random() * selectable.length)];
        const nextEntry = buckets.get(choice)!.shift();
        if (nextEntry) {
            randomized.push(nextEntry);
        }
        lastMatchId = choice;
    }

    return randomized;
}

function getMatchEntry(entry: CommentaryEntry, matchMap: Map<number, MatchState>): MatchState | null {
    if (!Number.isInteger(entry.matchId)) {
        return null;
    }
    return matchMap.get(entry.matchId as number) ?? null;
}

function randomMatchDelay(): number {
    const range = NEW_MATCH_DELAY_MAX_MS - NEW_MATCH_DELAY_MIN_MS;
    return NEW_MATCH_DELAY_MIN_MS + Math.floor(Math.random() * (range + 1));
}

async function seed(): Promise<void> {
    console.log(`📡 Seeding via API: ${API_URL}`);

    const { feed, matches: seedMatches } = await loadSeedData();
    const matchesList = await fetchMatches();

    const matchMap = new Map<number, MatchState>();
    const matchKeyMap = new Map<string, Match>();
    for (const match of matchesList) {
        if (FORCE_LIVE && !isLiveMatch(match)) {
            continue;
        }
        const key = `${match.sport}|${match.homeTeam}|${match.awayTeam}`;
        if (!matchKeyMap.has(key)) {
            matchKeyMap.set(key, match);
        }
        matchMap.set(match.id, {
            match,
            score: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
            fakeNext: Math.random() < 0.5 ? "home" : "away",
        });
    }

    if (Array.isArray(seedMatches) && seedMatches.length > 0) {
        for (const seedMatch of seedMatches) {
            const key = `${seedMatch.sport}|${seedMatch.homeTeam}|${seedMatch.awayTeam}`;
            let match = matchKeyMap.get(key);
            if (!match || (FORCE_LIVE && !isLiveMatch(match))) {
                match = await createMatch(seedMatch);
                matchKeyMap.set(key, match);
                const delayMs = randomMatchDelay();
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
            if (Number.isInteger(seedMatch.id)) {
                matchMap.set(seedMatch.id as number, {
                    match,
                    score: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
                    fakeNext: Math.random() < 0.5 ? "home" : "away",
                });
            }
            matchMap.set(match.id, {
                match,
                score: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
                fakeNext: Math.random() < 0.5 ? "home" : "away",
            });
        }
    }

    if (matchMap.size === 0) {
        throw new Error("No matches found or created in the database.");
    }

    const expandedFeed = expandFeedForMatches(feed, seedMatches);
    const randomizedFeed = buildRandomizedFeed(expandedFeed, matchMap);

    for (let i = 0; i < randomizedFeed.length; i += 1) {
        const entry = randomizedFeed[i];
        const target = getMatchEntry(entry, matchMap);
        if (!target) {
            console.warn(
                "⚠️  Skipping entry: matchId missing or not found:",
                entry.message,
            );
            continue;
        }
        const match = target.match;

        const row = await insertCommentary(match.id, entry);
        console.log(`📣 [Match ${match.id}] ${row.message}`);

        if (DELAY_MS > 0) {
            await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
    }
}

seed().catch((err) => {
    console.error("❌ Seed error:", err);
    process.exit(1);
});