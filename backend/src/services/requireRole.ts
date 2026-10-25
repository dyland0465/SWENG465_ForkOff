/**
 * requireRole.ts
 *
 * Express middleware that only lets certain kinds of accounts through. This is
 * Step 4 (authorization / restrictToRole) of the JWT security guide, built on top
 * of the existing session system instead of JWT:
 *
 *   router.use("/api/admin", requireRole("admin"))
 *
 *  - Not logged in → 401 "Login is required."
 *  - Logged in, but the account's role isn't in the list → 403 "Forbidden".
 *  - Otherwise → continues to the route.
 *
 * The role comes from req.identity, which sessionMiddleware fills in from the
 * database on every request (see session.ts), so it can't be faked by the client.
 */
import type { Request, Response, NextFunction } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.identity?.userId) return res.status(401).json({ message: "Login is required." });
    if (!roles.includes(req.identity.role ?? "user")) {
      return res.status(403).json({ message: "Forbidden: you don't have permission to do that." });
    }
    next();
  };
}