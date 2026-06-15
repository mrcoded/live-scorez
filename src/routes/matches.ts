import { desc } from 'drizzle-orm';
import { Router, Request, Response } from 'express';

import { db } from '@/db/db';
import { matches } from '@/db/schema';
import { MATCH_STATUS } from '@/validation/matches';
import { getMatchStatus } from '@/utils/match-status';
import { createMatchSchema, listMatchesQuerySchema } from '@/validation/matches';

export const matchRouter = Router();

const MAX_LIMIT = 100

matchRouter.get("/", async (req: Request, res: Response) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query)

    // Validation check
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT)

    try {
        const data = await db
            .select()
            .from(matches)
            .orderBy(desc(matches.createdAt))
            .limit(limit)

        return res.status(200).json({
            success: true,
            data
        })
    } catch (error) {
        console.log("Failed to fetch matches", JSON.stringify(error))
        return res.status(500).json({ error: "Failed to fetch matches", details: JSON.stringify(error) })
    }
})

matchRouter.post("/", async (req: Request, res: Response) => {
    const parsed = createMatchSchema.safeParse(req.body);

    // Validation check
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    }

    const { startTime, endTime, homeScore, awayScore } = parsed.data;


    try {
        const [event] = await db.insert(matches).values({
            ...parsed.data,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime) ?? MATCH_STATUS.SCHEDULED
        }).returning();

        res.status(201).json({
            success: true,
            event
        })
    } catch (error) {
        res.status(500).json({ error: "Failed to create match", details: JSON.stringify(error) })
    }
})