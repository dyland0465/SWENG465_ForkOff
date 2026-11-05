import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../src/api_routes/restaurantManagementRoutes";
import { Restaurant } from "../src/db_models/restaurant";
import { Lobby } from "../src/db_models/lobby";

const id = "507f1f77bcf86cd799439011";
test("restaurant management enforces ownership and saves details and menu", async () => {
  const originalFind = Restaurant.findOne, originalLobbyFind = Lobby.find;
  const record: any = { _id: id, placeId: "place123", partnerDetails: {}, menu: null, save: async () => record };
  Restaurant.findOne = (() => Object.assign(Promise.resolve(record), { lean: async () => record })) as any;
  Lobby.find = (() => ({ select: () => ({ lean: async () => [{ round: { decisions: { a: { place123: "yes" }, b: { place123: "veto" } } } }] }) })) as any;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { const role = req.get("x-role"); if (role) req.identity = { key: "u", userId: id, role, partnerStatus: "approved", restaurantIds: role === "partner" ? [id] : [] }; next(); });
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
    assert.deepEqual(analytics.decisions, { yes: 1, no: 0, veto: 1, skip: 0 });
  } finally {
    Restaurant.findOne = originalFind; Lobby.find = originalLobbyFind;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
