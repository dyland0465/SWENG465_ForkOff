/**
 * admin-api.test.ts
 *
 * Tests the admin-only partner review routes (adminApi.ts + requireRole.ts):
 *  - not logged in → 401; logged in as a regular user or partner → 403
 *  - an admin can list partners by status (no passwords in the response)
 *  - approving saves the restaurant and adds it to the partner's restaurantIds
 *  - bad partner IDs / Place IDs are rejected; unknown partners get 404
 *  - rejecting sets status "rejected" and removes restaurant access
 * The database is replaced with fakes, so this runs without MongoDB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../src/services/adminApi";
import { User } from "../src/models/user";
import { Restaurant } from "../src/models/restaurant";

test("admin partner review", async () => {
  const original = { find: User.find, update: User.findOneAndUpdate, restaurant: Restaurant.findOneAndUpdate };
  const partnerId = "507f1f77bcf86cd799439011";
  const app = express();
  app.use(express.json());
  // Stand-in for sessionMiddleware: the test picks the logged-in role with a header.
  app.use((req, _res, next) => {
    const role = req.get("x-test-role");
    if (role) req.identity = { key: "user:1", userId: "507f1f77bcf86cd7994390aa", role };
    next();
  });
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const { port } = server.address() as { port: number };
  const call = (path: string, role: string | null, method = "GET", body?: object) => fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(role ? { "x-test-role": role } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const doc = { _id: partnerId, username: "Harbor Owner", email: "owner@harbor.test", password: "$argon2-secret", partnerStatus: "pending", requestedRestaurant: { name: "Harbor & Hearth", address: "1 Pier St" }, restaurantIds: [], createdAt: "2026-10-25T00:00:00.000Z" };
  const chain = (value: unknown): any => ({ select: () => chain(value), sort: () => chain(value), limit: () => chain(value), lean: async () => value });

  try {
    // Who gets in
    assert.equal((await call("/api/admin/partners", null)).status, 401);
    assert.equal((await call("/api/admin/partners", "user")).status, 403);
    assert.equal((await call("/api/admin/partners", "partner")).status, 403);
    assert.equal((await call(`/api/admin/partners/${partnerId}/approve`, "partner", "POST", { placeId: "ChIJ_harbor_1234" })).status, 403);

    // Listing
    let lastFilter: any;
    User.find = ((filter: any) => { lastFilter = filter; return chain([doc]); }) as any;
    const list = await (await call("/api/admin/partners?status=pending", "admin")).json();
    assert.deepEqual(lastFilter, { role: "partner", partnerStatus: "pending" });
    assert.equal(list.partners[0].requestedRestaurant.name, "Harbor & Hearth");
    assert.equal(JSON.stringify(list).includes("argon2"), false, "no password in the response");
    await call("/api/admin/partners?status=all", "admin");
    assert.deepEqual(lastFilter, { role: "partner" });
    assert.equal((await call("/api/admin/partners?status=bogus", "admin")).status, 400);

    // Approving
    Restaurant.findOneAndUpdate = (async (filter: any) => { assert.deepEqual(filter, { placeId: "ChIJ_harbor_1234" }); return { _id: "rest1" }; }) as any;
    let lastUpdate: any;
    User.findOneAndUpdate = ((filter: any, update: any) => { lastUpdate = { filter, update }; return chain({ ...doc, partnerStatus: "approved", restaurantIds: ["rest1"] }); }) as any;
    const approved = await call(`/api/admin/partners/${partnerId}/approve`, "admin", "POST", { placeId: "ChIJ_harbor_1234" });
    assert.equal(approved.status, 200);
    assert.deepEqual(lastUpdate.filter, { _id: partnerId, role: "partner" });
    assert.deepEqual(lastUpdate.update, { $set: { partnerStatus: "approved" }, $addToSet: { restaurantIds: "rest1" } });
    assert.equal((await approved.json()).partner.status, "approved");
    assert.equal((await call("/api/admin/partners/not-an-id/approve", "admin", "POST", { placeId: "ChIJ_harbor_1234" })).status, 400);
    for (const placeId of ["", "short", "bad id with spaces", { $ne: null }]) {
      assert.equal((await call(`/api/admin/partners/${partnerId}/approve`, "admin", "POST", { placeId })).status, 400, JSON.stringify(placeId));
    }
    User.findOneAndUpdate = (() => chain(null)) as any;
    assert.equal((await call(`/api/admin/partners/${partnerId}/approve`, "admin", "POST", { placeId: "ChIJ_harbor_1234" })).status, 404);

    // Rejecting
    User.findOneAndUpdate = ((filter: any, update: any) => { lastUpdate = { filter, update }; return chain({ ...doc, partnerStatus: "rejected" }); }) as any;
    assert.equal((await call(`/api/admin/partners/${partnerId}/reject`, "admin", "POST")).status, 200);
    assert.deepEqual(lastUpdate.update, { $set: { partnerStatus: "rejected", restaurantIds: [] } });
  } finally {
    User.find = original.find; User.findOneAndUpdate = original.update; Restaurant.findOneAndUpdate = original.restaurant;
    server.close();
  }
});