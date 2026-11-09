import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { RateLimit } from "../db_models/rateLimit";

type Policy = { name: string; max: number; windowMs: number };
const minute = 60_000;
export function policyFor(method: string, path: string): Policy | undefined {
  if (method === "HEAD") method = "GET";
  const p = path.toLowerCase().replace(/\/+$/, "") || "/";
  if (["POST", "PUT", "DELETE"].includes(method) && p.startsWith("/api/saved/")) return { name: "saved-write", max: 60, windowMs: minute };
  if (method === "POST" && p === "/api/auth/login") return { name: "login", max: 10, windowMs: 15 * minute };
  if (method === "POST" && ["/api/users", "/api/partners/register"].includes(p)) return { name: "registration", max: 5, windowMs: 60 * minute };
  if (method === "POST" && p === "/api/lobbies") return { name: "lobby-create", max: 20, windowMs: 60 * minute };
  if (method === "POST" && /^\/api\/lobbies\/[^/]+\/join$/.test(p)) return { name: "lobby-join", max: 30, windowMs: 15 * minute };
  if (method === "POST" && /^\/api\/lobbies\/[^/]+\/messages$/.test(p)) return { name: "message", max: 60, windowMs: minute };
  if (method === "POST" && /^\/api\/lobbies\/[^/]+\/round\/engagement$/.test(p)) return { name: "engagement", max: 120, windowMs: minute };
  if ((method === "GET" && (/^\/api\/places\/[^/]+(?:\/(?:photos|reviews))?$/.test(p) || /^\/api\/restaurants(?:\/[^/]+)?$/.test(p) || /^\/api\/lobbies\/[^/]+\/restaurants$/.test(p) || p === "/api/admin/places")) ||
      (method === "POST" && (p === "/api/restaurants/import" || /^\/api\/lobbies\/[^/]+\/round$/.test(p)))) return { name: "places", max: 30, windowMs: minute };
}
export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const policy = policyFor(req.method, req.path);
  if (!policy) return next();
  const now = Date.now(), window = Math.floor(now / policy.windowMs), reset = (window + 1) * policy.windowMs;
  // req.ip uses Express trust-proxy configuration; never trust client headers directly.
  const client = createHash("sha256").update(req.ip ?? req.socket.remoteAddress ?? "unknown").digest("hex");
  const _id = `${policy.name}:${window}:${client}`;
  try {
    let counter;
    try {
      counter = await RateLimit.findOneAndUpdate({ _id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(reset + policy.windowMs) } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: false }).lean();
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      counter = await RateLimit.findOneAndUpdate({ _id }, { $inc: { count: 1 } }, { returnDocument: "after" }).lean();
    }
    if (!counter) throw new Error("Rate limit counter unavailable");
    res.set("RateLimit-Limit", String(policy.max));
    res.set("RateLimit-Remaining", String(Math.max(0, policy.max - counter.count)));
    res.set("RateLimit-Reset", String(Math.ceil(reset / 1000)));
    if (counter.count > policy.max) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((reset - now) / 1000))));
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    return next();
  } catch (error) {
    console.error("Rate limit storage unavailable", error);
    return res.status(503).json({ message: "Service temporarily unavailable." });
  }
}
