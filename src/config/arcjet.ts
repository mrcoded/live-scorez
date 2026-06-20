import { Request, Response, NextFunction } from "express"
import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node"

const arcjetKey = process.env.ARCJET_KEY
const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE"

if (!arcjetKey) throw new Error("MISSING Environment Variables for Arcjet_Key")

export const httpArcjet = arcjetKey ? arcjet({
    key: arcjetKey,
    characteristics: ["ip.src"] as const,
    // Tell Arcjet to trust internal proxy IPs. 
    // It will now safely parse the real IP from the X-Forwarded-For header.
    proxies: ["127.0.0.1", "::1", "10.0.0.0/8"],
    rules: [
        shield({ mode: arcjetMode }),
        detectBot({ mode: arcjetMode, allow: ["CATEGORY:PREVIEW", "CATEGORY:SEARCH_ENGINE"] }),
        slidingWindow({ mode: arcjetMode, interval: "10s", max: 50 })
    ]
}) : null

export const wsArcjet = arcjetKey ? arcjet({
    key: arcjetKey,

    // Tell Arcjet to trust internal proxy IPs. 
    // It will now safely parse the real IP from the X-Forwarded-For header.
    proxies: ["127.0.0.1", "::1", "10.0.0.0/8"],
    rules: [
        shield({ mode: arcjetMode }),
        detectBot({ mode: arcjetMode, allow: ["CATEGORY:PREVIEW", "CATEGORY:SEARCH_ENGINE"] }),
        slidingWindow({ mode: arcjetMode, interval: "2s", max: 5 })
    ]
}) : null


export function securityMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!httpArcjet) return next()

        try {
            const decision = await httpArcjet.protect(req)

            if (decision.isDenied()) {
                if (decision.reason.isRateLimit()) {
                    return res.status(429).json({ error: "Too many requests" })
                }

                return res.status(403).json({ error: "Forbidden" })
            }

            // Let the valid request pass to the matches controller
            next();
        } catch (error) {
            console.error("Arcjet middleware error", error)
            return res.status(503).json({ error: "Service unavailable" })
        }
    }
}