/**
 * partner-register.test.ts
 *
 * Tests POST /api/partners/register (partner create-account):
 *  - a valid request creates the account as role "partner" / partnerStatus "pending",
 *    stores the claimed restaurant, hashes the password, and logs them in (cookie)
 *  - the role can't be chosen by the client (sending role: "admin" is ignored)
 *  - missing fields, a bad email, or a short password are rejected with 400
 *  - an email that's already used gets 409
 * The database is replaced with fakes, so this runs without MongoDB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../src/routes";
import { User } from "../src/models/user";
import { Session } from "../src/models/session";

test("partner registration", async () => {
  const original = { create: User.create, session: Session.create };
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const { port } = server.address() as { port: number };
  const register = (body: object) => fetch(`http://127.0.0.1:${port}/api/partners/register`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const valid = { username: "Harbor Owner", email: " Owner@Harbor.test ", password: "longenough", restaurantName: "Harbor & Hearth", restaurantAddress: "1 Pier St" };

  let saved: any;
  try {
    Session.create = (async () => ({})) as any;
    User.create = (async (doc: any) => { saved = doc; return { _id: "507f1f77bcf86cd799439011", ...doc }; }) as any;

    const created = await register({ ...valid, role: "admin", partnerStatus: "approved", restaurantIds: ["x"] });
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.user.role, "partner");
    assert.equal(body.user.partnerStatus, "pending");
    assert.match(created.headers.get("set-cookie")!, /forkoff_session=/);
    assert.equal(saved.role, "partner");
    assert.equal(saved.partnerStatus, "pending");
    assert.deepEqual(saved.restaurantIds, []);
    assert.equal(saved.email, "owner@harbor.test");
    assert.deepEqual(saved.requestedRestaurant, { name: "Harbor & Hearth", address: "1 Pier St" });
    assert.match(saved.password, /^\$argon2/);

    for (const bad of [{ ...valid, restaurantName: "" }, { ...valid, restaurantAddress: "  " }, { ...valid, email: "nope" }, { ...valid, password: "short" }, { ...valid, username: { $ne: null } }, {}]) {
      assert.equal((await register(bad)).status, 400, JSON.stringify(bad));
    }

    User.create = (async () => { throw { code: 11000 }; }) as any;
    assert.equal((await register(valid)).status, 409);
  } finally {
    User.create = original.create;
    Session.create = original.session;
    server.close();
  }
});