import { Router } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { createCommentarySchema } from "../validation/commentary.js";

export const commentaryRouter = Router({ mergeParams: true });

import { eq, desc } from "drizzle-orm";
import { listCommentaryQuerySchema } from "../validation/commentary.js";

const MAX_LIMIT = 100;

commentaryRouter.get("/", async (req, res) => {
    try {
        const paramValidation = matchIdParamSchema.safeParse(req.params);
        if (!paramValidation.success) {
            return res.status(400).json({ error: paramValidation.error.issues });
        }

        const queryValidation = listCommentaryQuerySchema.safeParse(req.query);
        if (!queryValidation.success) {
            return res.status(400).json({ error: queryValidation.error.issues });
        }

        const matchId = paramValidation.data.id;
        const limit = Math.min(queryValidation.data.limit ?? 100, MAX_LIMIT);

        const data = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, matchId))
            .orderBy(desc(commentary.createdAt))
            .limit(limit);

        res.status(200).json({ data });
    } catch (error) {
        console.error("Failed to fetch commentary:", error);
        res.status(500).json({
            error: "Failed to fetch commentary",
            details: error instanceof Error ? error.message : JSON.stringify(error)
        });
    }
});

commentaryRouter.post("/", async (req, res) => {
    try {
        const paramValidation = matchIdParamSchema.safeParse(req.params);
        if (!paramValidation.success) {
            return res.status(400).json({ error: paramValidation.error.issues });
        }

        const bodyValidation = createCommentarySchema.safeParse(req.body);
        if (!bodyValidation.success) {
            return res.status(400).json({ error: bodyValidation.error.issues });
        }

        const matchId = paramValidation.data.id;
        const commentaryData = bodyValidation.data;

        const [newCommentary] = await db.insert(commentary).values({
            matchId,
            ...commentaryData,
            sequence: commentaryData.sequence ?? 0,
            eventType: commentaryData.eventType ?? "system",
        }).returning();

        res.status(201).json({ data: newCommentary });
    } catch (error) {
        console.error("Failed to create commentary:", error);
        res.status(500).json({
            error: "Failed to create commentary",
            details: error instanceof Error ? error.message : JSON.stringify(error)
        });
    }
});