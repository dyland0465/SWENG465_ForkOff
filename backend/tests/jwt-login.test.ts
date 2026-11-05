import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import auth from "../src/api_routes/authRoutes";
import lobby from "../src/api_routes/lobbyRoutes";
import { sessionMiddleware } from "../src/services/session";
import { hashPassword } from "../src/services/passwordHashing";
import { Session } from "../src/db_models/session";
import { User } from "../src/db_models/user";

test("login issues a JWT cookie and logout revokes it", async () => {
  process.env.JWT_SECRET = "test-only-secret-at-least-32-bytes-long";
  const old = { userFind: User.findOne, userId: User.findById, create: Session.create, find: Session.findOne, del: Session.deleteOne };
  const id = "507f1f77bcf86cd799439011";
  const user = { _id: id, username: "Alice", email: "alice@example.test", password: await hashPassword("secret-password"), role: "user", restaurantIds: [] };
  const sessions = new Map<string, any>();
  User.findOne = (async () => user) as any;
  User.findById = (() => ({ select: () => ({ lean: async () => user }) })) as any;
  Session.create = (async (doc: any) => { sessions.set(doc.tokenHash, doc); return doc; }) as any;
  Session.findOne = ((query: any) => ({ lean: async () => sessions.get(query.tokenHash) ?? null })) as any;
  Session.deleteOne = (async (query: any) => { sessions.delete(query.tokenHash); return {}; }) as any;
  const app = express(); app.use(express.json()); app.use(sessionMiddleware); app.use(auth); app.use(lobby);
  app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const bad = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "Alice", password: "wrong" }) });
    assert.equal(bad.status, 401);
    const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "Alice", password: "secret-password" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    assert.equal(cookie.split("=")[1].split(".").length, 3);
    const check = await fetch(`${base}/api/auth/session`, { headers: { cookie } });
    assert.equal((await check.json()).user.id, id);
    const logout = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie } });
    assert.equal(logout.status, 200);
    const after = await fetch(`${base}/api/auth/session`, { headers: { cookie } });
    assert.equal((await after.json()).user, null);
  } finally {
    User.findOne = old.userFind; User.findById = old.userId; Session.create = old.create; Session.findOne = old.find; Session.deleteOne = old.del;
    delete process.env.JWT_SECRET;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
