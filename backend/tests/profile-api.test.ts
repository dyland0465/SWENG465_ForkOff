import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../src/services/api";
import { User } from "../src/models/user";
import { Restaurant } from "../src/models/restaurant";
import { Session } from "../src/models/session";
import { sessionEvents } from "../src/services/session";

test("profile, deletion, and reviews endpoints", async () => {
  const id = "507f1f77bcf86cd799439011";
  const original = { find: User.findById, update: User.findByIdAndUpdate, delete: User.findByIdAndDelete, restaurant: Restaurant.findOneAndDelete, sessions: Session.deleteMany, fetch: globalThis.fetch };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.get("x-test-user")) req.identity = { key: `user:${id}`, userId: req.get("x-test-user") };
    next();
  });
  app.use(router);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status ?? 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const request = (path: string, method = "GET", body?: object, user: string | null = id) => original.fetch(`http://127.0.0.1:${address.port}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const query = (value: unknown): any => ({ select: () => ({ lean: async () => value }) });
  let revoked = "";
  const listener = (value: string) => { revoked = value; };
  sessionEvents.on("userRevoked", listener);
  try {
    User.findById = (() => query({ _id: id, username: "Alice", email: "alice@example.com", password: "secret" })) as any;
    assert.equal((await request(`/api/users/${id}`, "GET", undefined, null)).status, 401);
    assert.equal((await request("/api/users/invalid")).status, 400);
    assert.equal((await request(`/api/users/${id}`, "GET", undefined, "507f1f77bcf86cd799439012")).status, 403);
    assert.deepEqual(await (await request(`/api/users/${id}`)).json(), { id, username: "Alice", email: "alice@example.com" });
    User.findById = (() => query(null)) as any;
    assert.equal((await request(`/api/users/${id}`)).status, 404);
    User.findByIdAndUpdate = ((_id: any, update: any, options: any) => {
      assert.deepEqual(update, { $set: { username: "Bob", email: "bob@example.com" } });
      assert.equal(options.runValidators, true);
      return query({ _id: id, ...update.$set });
    }) as any;
    assert.equal((await request(`/api/users/${id}`, "PATCH", { username: " Bob ", email: " BOB@example.com " })).status, 200);
    for (const body of [{ username: " " }, { email: "bad" }, { password: "secret" }, { email: { $ne: null } }, {}]) {
      assert.equal((await request(`/api/users/${id}`, "PATCH", body)).status, 400);
    }
    User.findByIdAndUpdate = (() => { throw { code: 11000 }; }) as any;
    assert.equal((await request(`/api/users/${id}`, "PATCH", { username: "Bob" })).status, 409);
    User.findByIdAndDelete = (async () => ({ _id: id })) as any;
    Session.deleteMany = (async (filter: any) => { assert.deepEqual(filter, { userId: id }); return {}; }) as any;
    const deleted = await request(`/api/users/${id}`, "DELETE");
    assert.equal(deleted.status, 200);
    assert.match(deleted.headers.get("set-cookie")!, /forkoff_session=;/);
    assert.equal(revoked, id);
    User.findByIdAndDelete = (async () => null) as any;
    assert.equal((await request(`/api/users/${id}`, "DELETE")).status, 404);
    Restaurant.findOneAndDelete = (async (filter: any) => { assert.deepEqual(filter, { placeId: "place123" }); return { placeId: "place123" }; }) as any;
    assert.equal((await request("/api/restaurants/place123", "DELETE", undefined, null)).status, 401);
    assert.equal((await request("/api/restaurants/place123", "DELETE")).status, 200);
    Restaurant.findOneAndDelete = (async () => null) as any;
    assert.equal((await request("/api/restaurants/missing", "DELETE")).status, 404);
    const previousKey = process.env.GOOGLE_PLACES;
    try {
      process.env.GOOGLE_PLACES = "test-key";
      const reviews = [{ rating: 5, authorAttribution: { displayName: "Alice", uri: "https://example.com/author" }, text: { text: "Great" } }];
      globalThis.fetch = (async (_url: any, options: any) => {
        assert.equal(options.headers["X-Goog-FieldMask"], "reviews");
        return new Response(JSON.stringify({ reviews }));
      }) as any;
      assert.deepEqual(await (await request("/api/places/place123/reviews")).json(), { placeId: "place123", attribution: "Google Maps", reviews });
      globalThis.fetch = (async () => new Response("{}")) as any;
      assert.deepEqual((await (await request("/api/places/place123/reviews")).json()).reviews, []);
      globalThis.fetch = (async () => new Response("{}", { status: 404 })) as any;
      assert.equal((await request("/api/places/missing/reviews")).status, 404);
      delete process.env.GOOGLE_PLACES;
      assert.equal((await request("/api/places/place123/reviews")).status, 503);
    } finally {
      if (previousKey === undefined) delete process.env.GOOGLE_PLACES; else process.env.GOOGLE_PLACES = previousKey;
    }
  } finally {
    User.findById = original.find; User.findByIdAndUpdate = original.update; User.findByIdAndDelete = original.delete;
    Restaurant.findOneAndDelete = original.restaurant; Session.deleteMany = original.sessions; globalThis.fetch = original.fetch;
    sessionEvents.off("userRevoked", listener);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
