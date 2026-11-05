import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { Session } from "../src/db_models/session";
import { User } from "../src/db_models/user";
import { establishSession, resolveIdentity, revokeSession, jwtSecret } from "../src/services/session";

const secret = "unit-test-only-secret-32-bytes-minimum";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

test("JWT sessions verify signature, claims, expiry and server-side revocation", async () => {
  process.env.JWT_SECRET = secret;
  const original = { create: Session.create, find: Session.findOne, del: Session.deleteOne, user: User.findById };
  const sessions = new Map<string, any>();
  Session.create = (async (doc: any) => { sessions.set(doc.tokenHash, doc); return doc; }) as any;
  Session.findOne = ((query: any) => ({ lean: async () => { const record = sessions.get(query.tokenHash); return record && record.expiresAt > query.expiresAt.$gt ? record : null; } })) as any;
  Session.deleteOne = (async (query: any) => { sessions.delete(query.tokenHash); return {}; }) as any;
  User.findById = (() => ({ select: () => ({ lean: async () => ({ _id: "user1", username: "Alice", email: "a@example.test", role: "admin", restaurantIds: [] }) }) })) as any;
  let token = ""; let cookieOptions: any;
  const req: any = { headers: {} };
  const res: any = { cookie: (_name: string, value: string, options: any) => { token = value; cookieOptions = options; } };
  try {
    await establishSession(req, res, { id: "user1", username: "Alice", email: "a@example.test" });
    assert.equal(token.split(".").length, 3);
    assert.equal(cookieOptions.httpOnly, true);
    assert.equal(cookieOptions.sameSite, "lax");
    assert.equal((await resolveIdentity(`forkoff_session=${token}`))?.role, "admin");
    const parts = token.split(".");
    const altered = `${parts[0]}.${parts[1]}.${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
    assert.equal(await resolveIdentity(`forkoff_session=${altered}`), undefined);
    const wrongSecret = jwt.sign({}, "different-secret-at-least-32-bytes", { algorithm: "HS256", issuer: "forkoff", audience: "forkoff-web", subject: "user:user1", jwtid: "x", expiresIn: 60 });
    assert.equal(await resolveIdentity(`forkoff_session=${wrongSecret}`), undefined);
    const expired = jwt.sign({}, secret, { algorithm: "HS256", issuer: "forkoff", audience: "forkoff-web", subject: "user:user1", jwtid: "x", expiresIn: -1 });
    sessions.set(hash(expired), { tokenHash: hash(expired), identityKey: "user:user1", expiresAt: new Date(Date.now() + 60000) });
    assert.equal(await resolveIdentity(`forkoff_session=${expired}`), undefined);
    const wrongAudience = jwt.sign({}, secret, { algorithm: "HS256", issuer: "forkoff", audience: "other", subject: "user:user1", jwtid: "x", expiresIn: 60 });
    assert.equal(await resolveIdentity(`forkoff_session=${wrongAudience}`), undefined);
    const noExp = jwt.sign({}, secret, { algorithm: "HS256", issuer: "forkoff", audience: "forkoff-web", subject: "user:user1", jwtid: "x" });
    assert.equal(await resolveIdentity(`forkoff_session=${noExp}`), undefined);
    const cookie = `forkoff_session=${token}`;
    await revokeSession(cookie);
    assert.equal(await resolveIdentity(cookie), undefined);
    await establishSession({ headers: {} } as any, res);
    assert.match((await resolveIdentity(`forkoff_session=${token}`))!.key, /^guest:/);
    assert.equal(await resolveIdentity("forkoff_session=" + "a".repeat(64)), undefined);
    process.env.JWT_SECRET = "short";
    assert.throws(jwtSecret, /JWT_SECRET/);
  } finally {
    Session.create = original.create; Session.findOne = original.find; Session.deleteOne = original.del; User.findById = original.user;
    delete process.env.JWT_SECRET;
  }
});
