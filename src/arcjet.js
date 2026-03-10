import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;

const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE";

if (!arcjetKey) throw new Error("ARCJET_KEY is not defined");

export const httpArcjet = arcjetKey ? arcjet({
    key: arcjetKey,
    rules: [
        shield({ mode: arcjetMode }),
        detectBot({
            mode: arcjetMode,
            allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({ mode: arcjetMode, interval: "10s", max: 50 }),
    ],
})
    : null;

export const wsArcjet = arcjetKey ? arcjet({
    key: arcjetKey,
    rules: [
        shield({ mode: arcjetMode }),
        detectBot({
            mode: arcjetMode,
            allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({ mode: arcjetMode, interval: "2s", max: 5 }),
    ],
}) : null;

/**
 * Create an Express middleware that enforces Arcjet protection on incoming HTTP requests.
 *
 * The returned middleware calls next() immediately if no Arcjet HTTP client is configured.
 * When Arcjet is available it invokes protection and:
 * - responds with 429 and {"error":"Too many requests"} if the decision is denied due to rate limiting,
 * - responds with 403 and {"error":"Forbidden."} if the decision is denied for any other reason,
 * - logs the error and responds with 503 and {"error":"Service unavailable"} if Arcjet protection throws.
 *
 * @returns {import('express').RequestHandler} An Express-style middleware (req, res, next).
 */
export function securityMiddleware() {
    return async (req, res, next) => {
        if (!httpArcjet) return next();

        try {
            const decision = await httpArcjet.protect(req)
            if (decision.isDenied()) {
                if (decision.reason.isRateLimit()) {
                    return res.status(429).json({ error: "Too many requests" })
                }
                return res.status(403).json({ error: "Forbidden." })
            }

        } catch (error) {
            console.error("Arcjet middleware error:", error);
            return res.status(503).json({ error: "Service unavailable" })
        }
        next();
    }
}