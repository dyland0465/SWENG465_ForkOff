import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { RateLimit } from "../src/db_models/rateLimit";
import { rateLimit, policyFor } from "../src/middleware/rateLimit";

test("shared counters limit anonymous and authenticated traffic and fail closed", async () => {
  const original = RateLimit.findOneAndUpdate;
  const counts = new Map<string, number>();
  RateLimit.findOneAndUpdate = ((filter: any) => ({ lean: async () => { const count = (counts.get(filter._id) ?? 0) + 1; counts.set(filter._id, count); return { count }; } })) as any;
  const app = express(); app.set("trust proxy", 1); app.use(rateLimit); app.use((_req, res) => res.sendStatus(204));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    for (let i = 0; i < 10; i++) assert.equal((await fetch(`${base}/API/AUTH/LOGIN/`, { method: "POST", headers: { "x-forwarded-for": "203.0.113.9", ...(i % 2 ? { cookie: "forkoff_session=anything" } : {}) } })).status, 204);
    const blocked = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "x-forwarded-for": "203.0.113.9" } });
    assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.equal((await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "x-forwarded-for": "203.0.113.10" } })).status, 204);
    for (const [method, path] of [["POST", "/api/users"], ["POST", "/api/partners/register"], ["POST", "/api/lobbies"], ["POST", "/api/lobbies/x/join"], ["POST", "/api/lobbies/x/messages"], ["POST", "/api/restaurants/import"], ["GET", "/api/places/x/photos"], ["GET", "/api/lobbies/x/restaurants"], ["POST", "/api/lobbies/x/round"]]) assert.ok(policyFor(method, path), `${method} ${path}`);
    assert.equal(policyFor("HEAD", "/api/places/x")?.name, "places");
    RateLimit.findOneAndUpdate = (() => ({ lean: async () => { throw new Error("unavailable"); } })) as any;
    assert.equal((await fetch(`${base}/api/places/x`)).status, 503);
  } finally { RateLimit.findOneAndUpdate = original; await new Promise<void>((r, j) => server.close(e => e ? j(e) : r())); }
});
