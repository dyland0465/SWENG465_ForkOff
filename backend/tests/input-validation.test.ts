import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import userRoutes from "../src/api_routes/userRoutes";
import partnerRoutes from "../src/api_routes/partnerRoutes";
import restaurantRoutes from "../src/api_routes/restaurantRoutes";

test("registration validation is consistent and import rejects malformed public input", async () => {
  const app = express(); app.use(express.json()); app.use(userRoutes); app.use(partnerRoutes); app.use(restaurantRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => res.status(err.status ?? 500).json({ message: err.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const post = (path: string, body: any) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    for (const path of ["/api/users", "/api/partners/register"]) {
      for (const input of [{ username: "x", email: "a@b.test", password: "short" }, { username: "x", email: "bad", password: "longenough" }, { username: {}, email: "a@b.test", password: "longenough" }, { username: "x", email: "a@b.test", password: "x".repeat(129) }])
        assert.equal((await post(path, { ...input, restaurantName: "Cafe", restaurantAddress: "123 St" })).status, 400);
    }
    for (const input of [{ query: {} }, { query: "" }, { limit: "3" }, { limit: 11 }, { query: "x", unexpected: true }, []])
      assert.equal((await post("/api/restaurants/import", input)).status, 400);
  } finally { await new Promise<void>((r, j) => server.close(e => e ? j(e) : r())); }
});
