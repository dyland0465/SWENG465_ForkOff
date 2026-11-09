import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../src/api_routes/restaurantManagementRoutes";
import { Restaurant } from "../src/db_models/restaurant";
import { AnalyticsEvent, AnalyticsMetadata, AnalyticsRound } from "../src/db_models/telemetry";
import { Favorite, RestaurantCollection } from "../src/db_models/saved";

const id = "507f1f77bcf86cd799439011";
test("restaurant management enforces ownership and saves details and menu", async () => {
  const originalFind = Restaurant.findOne, roundFind = AnalyticsRound.find, eventFind = AnalyticsEvent.find, metaFind = AnalyticsMetadata.findOne;
  const favoriteCount = Favorite.countDocuments, collectionCount = RestaurantCollection.countDocuments;
  const record: any = { _id: id, placeId: "place123", partnerDetails: {}, menu: null, save: async () => record };
  Restaurant.findOne = (() => Object.assign(Promise.resolve(record), { lean: async () => record })) as any;
  AnalyticsRound.find = (() => ({ lean: async () => [{ startedAt: new Date(), endedAt: new Date(), status: "completed", restaurants: [{ placeId: "place123", yes: 1, no: 0, veto: 1, skip: 0, vetoed: true }] }] })) as any;
  AnalyticsEvent.find = (() => ({ lean: async () => [] })) as any;
  AnalyticsMetadata.findOne = (() => ({ lean: async () => ({ startedAt: new Date() }) })) as any;
  Favorite.countDocuments = (async () => 2) as any;
  RestaurantCollection.countDocuments = (async () => 3) as any;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { const role = req.get("x-role"); if (role) req.identity = { key: "u", userId: id, role: role.startsWith("partner") ? "partner" : role, partnerStatus: role === "partner-pending" ? "pending" : "approved", restaurantIds: role === "partner" || role === "partner-pending" ? [id] : [] }; next(); });
  app.use(router); app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status ?? 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (path: string, method = "GET", body?: object, role?: string) => fetch(base + path, { method, headers: { "content-type": "application/json", ...(role ? { "x-role": role } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await call(`/api/restaurants/${id}`, "PATCH", { restaurantName: "New" })).status, 401);
    assert.equal((await call(`/api/restaurants/${id}`, "PATCH", { restaurantName: "New" }, "user")).status, 403);
    assert.equal((await call(`/api/restaurants/${id}`, "PATCH", { bad: "x" }, "partner")).status, 400);
    assert.equal((await call(`/api/restaurants/${id}`, "PATCH", { restaurantName: "New" }, "partner")).status, 200);
    assert.equal(record.partnerDetails.restaurantName, "New");
    assert.equal((await call(`/api/restaurants/${id}/menu`, "PATCH", { menu: { categories: [] } }, "partner")).status, 200);
    assert.deepEqual((await (await call(`/api/restaurants/${id}/menu`)).json()).menu, { categories: [] });
    const analytics = await (await call(`/api/restaurants/${id}/analytics`, "GET", undefined, "partner")).json();
    assert.equal(analytics.totals.yes, 1); assert.equal(analytics.totals.veto, 1);
    assert.deepEqual(analytics.current, { favorites: 2, collections: 3 });
    assert.equal((await call(`/api/restaurants/${id}/analytics?start=bad`, "GET", undefined, "partner")).status, 400);
    assert.equal((await call(`/api/restaurants/${id}/analytics`, "GET", undefined, "user")).status, 403);
    assert.equal((await call(`/api/restaurants/${id}/analytics`, "GET", undefined, "partner-pending")).status, 403);
    assert.equal((await call(`/api/restaurants/${id}/analytics`, "GET", undefined, "partner-other")).status, 403);
    assert.equal((await call(`/api/restaurants/${id}/analytics`, "GET", undefined, "admin")).status, 200);
  } finally {
    Restaurant.findOne = originalFind; AnalyticsRound.find = roundFind; AnalyticsEvent.find = eventFind; AnalyticsMetadata.findOne = metaFind;
    Favorite.countDocuments = favoriteCount; RestaurantCollection.countDocuments = collectionCount;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
