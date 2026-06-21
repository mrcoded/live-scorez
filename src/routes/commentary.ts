import { Router, Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/db";
import { commentary, matches } from "@/db/schema";
import { matchIdParamSchema } from "@/validation/matches";
import { createCommentarySchema, listCommentaryQuerySchema } from "@/validation/commentary";

const MAX_LIMIT = 100;

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.post("/", async (req: Request, res: Response) => {
    const paramsParsed = matchIdParamSchema.safeParse(req.params);

    if (!paramsParsed.success) {
        return res.status(400).json({ error: "Invalid match ID", details: paramsParsed.error.issues });
    }

    const bodyParsed = createCommentarySchema.safeParse(req.body);

    if (!bodyParsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: bodyParsed.error.issues });
    }

    const matchId = paramsParsed.data.id;

    try {
        // Verify that the match exists
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
        if (match.length === 0) {
            return res.status(404).json({ error: "Match not found" });
        }

        const { minutes, ...rest } = bodyParsed.data

        const [inserted] = await db.insert(commentary).values({
            matchId,
            minutes,
            ...rest
        }).returning();

        // broadcast to all clients
        if (res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(inserted.matchId, inserted)
        }

        return res.status(201).json({
            success: true,
            data: inserted,
        });
    } catch (error) {
        console.error("Failed to create commentary", error);
        return res.status(500).json({
            error: "Failed to create commentary",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

commentaryRouter.get("/", async (req: Request, res: Response) => {
    const paramsParsed = matchIdParamSchema.safeParse(req.params);

    if (!paramsParsed.success) {
        return res.status(400).json({ error: "Invalid match ID", details: paramsParsed.error.issues });
    }

    const queryParsed = listCommentaryQuerySchema.safeParse(req.query);

    if (!queryParsed.success) {
        return res.status(400).json({ error: "Invalid query parameters", details: queryParsed.error.issues });
    }

    const matchId = paramsParsed.data.id;
    const limit = Math.min(queryParsed.data.limit ?? 100, MAX_LIMIT);

    try {
        // Verify that the match exists
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
        if (match.length === 0) {
            return res.status(404).json({ error: "Match not found" });
        }

        const data = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, matchId))
            .orderBy(desc(commentary.createdAt))
            .limit(limit);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("Failed to fetch commentary", error);
        return res.status(500).json({
            error: "Failed to fetch commentary",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});