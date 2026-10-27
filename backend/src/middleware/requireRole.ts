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

//basically this checks if the user is logged in and has the required role to access a specific route. If the user is not logged in, it returns a 401 status code with a message indicating that login is required. If the user is logged in but does not have the required role, it returns a 403 status code with a message indicating that they do not have permission to access the resource. If the user is logged in and has the required role, it calls the next middleware or route handler.
//so like only admins can access certain endpoints. 