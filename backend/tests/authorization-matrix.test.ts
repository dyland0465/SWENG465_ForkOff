import { Favorite, RestaurantCollection, SavedGroup, GroupInvitation, CollectionShare } from "../src/db_models/saved";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { sessionMiddleware } from "../src/services/session";
import routes from "../src/api_routes";
import { Session } from "../src/db_models/session";
import { User } from "../src/db_models/user";
import { Restaurant } from "../src/db_models/restaurant";
import { Lobby } from "../src/db_models/lobby";

const secret = "test-only-secret-at-least-32-bytes-long";
const ownerId = "507f1f77bcf86cd799439011", otherId = "507f1f77bcf86cd799439012", restaurantId = "507f1f77bcf86cd799439013";
test("verified JWT authorization matrix for accounts, shared restaurants, admin and lobbies", async () => {
  process.env.JWT_SECRET = secret;
  const cleanupModels = [Favorite, RestaurantCollection, SavedGroup, GroupInvitation, CollectionShare];
  const cleanupDelete = cleanupModels.map(model => model.deleteMany);
  const groupUpdate = SavedGroup.updateMany;
  cleanupModels.forEach(model => { model.deleteMany = (async () => ({})) as any; });
  SavedGroup.updateMany = (async () => ({})) as any;
  const old = { session: Session.findOne, user: User.findById, users: User.find, restaurant: Restaurant.findOne, del: Restaurant.findOneAndDelete, lobby: Lobby.findOne, lobbyUpdate: Lobby.findOneAndUpdate, profileUpdate: User.findByIdAndUpdate, profileDelete: User.findByIdAndDelete, sessionDelete: Session.deleteMany };
  let role = "user", status = "approved", ids: string[] = [];
  const cookieFor = (subject: string, expiresIn: number = 60) => `forkoff_session=${jwt.sign({}, secret, { algorithm: "HS256", issuer: "forkoff", audience: "forkoff-web", subject, jwtid: subject, expiresIn })}`;
  const token = cookieFor(`user:${ownerId}`), other = cookieFor(`user:${otherId}`), guest = cookieFor("guest:outside");
  const sessions = new Map([token, other, guest].map(c => { const t = c.split("=")[1]; const decoded = jwt.decode(t) as jwt.JwtPayload; return [createHash("sha256").update(t).digest("hex"), { identityKey: decoded.sub, ...(decoded.sub!.startsWith("user:") ? { userId: decoded.sub!.slice(5) } : {}) }]; }));
  Session.findOne = ((query: any) => ({ lean: async () => sessions.get(query.tokenHash) ?? null })) as any;
  User.findById = ((id: string) => ({ select: () => ({ lean: async () => ({ _id: String(id), username: "Alice", email: "a@example.test", role, partnerStatus: status, restaurantIds: ids }) }) })) as any;
  User.find = (() => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) })) as any;
  Restaurant.findOne = (async () => ({ _id: restaurantId, placeId: "place" })) as any;
  let deletions = 0; Restaurant.findOneAndDelete = (async () => { deletions++; return { _id: restaurantId }; }) as any;
  const lobby: any = { _id: ownerId, lobbyCode: "ABC123", revision: 0, hostMemberId: "host", members: [{ memberId: "host", identityKey: `user:${ownerId}`, joinOrder: 1, displayName: "Alice", type: "user" }], filters: {}, status: "waiting" };
  Lobby.findOne = (async () => lobby) as any;
  Lobby.findOneAndUpdate = (async () => lobby) as any;
  User.findByIdAndUpdate = (() => ({ select: () => ({ lean: async () => ({ _id: ownerId, username: "Changed", email: "a@example.test" }) }) })) as any;
  User.findByIdAndDelete = (async () => ({ _id: ownerId })) as any;
  Session.deleteMany = (async () => ({})) as any;
  const app = express(); app.use(express.json()); app.use(sessionMiddleware); app.use(routes); app.use((e: any, _q: any, r: any, _n: any) => r.status(e.status ?? 500).json({ message: e.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (path: string, method = "GET", cookie?: string, body?: any) => fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}) });
  try {
    for (const method of ["GET", "PATCH", "DELETE"]) {
      assert.equal((await call(`/api/users/${ownerId}`, method, undefined, { username: "x" })).status, 401);
      assert.equal((await call(`/api/users/${ownerId}`, method, other, { username: "x" })).status, 403);
      assert.equal((await call(`/api/users/${ownerId}`, method, "forkoff_session=invalid", { username: "x" })).status, 401);
    }
    assert.equal((await call(`/api/users/${ownerId}`, "GET", token)).status, 200);
    assert.equal((await call(`/api/users/${ownerId}`, "PATCH", token, { username: "Changed" })).status, 200);
    assert.equal((await call(`/api/restaurants/${restaurantId}`, "DELETE")).status, 401);
    assert.equal((await call(`/api/restaurants/${restaurantId}`, "DELETE", token)).status, 403);
    role = "partner"; status = "pending"; ids = [restaurantId]; assert.equal((await call(`/api/restaurants/${restaurantId}`, "DELETE", token)).status, 403);
    status = "approved"; ids = []; assert.equal((await call(`/api/restaurants/${restaurantId}`, "DELETE", token)).status, 403);
    ids = [restaurantId]; assert.equal((await call(`/api/restaurants/${restaurantId}`, "DELETE", token)).status, 200);
    role = "admin"; ids = []; assert.equal((await call(`/api/restaurants/${restaurantId}`, "DELETE", token)).status, 200); assert.equal(deletions, 2);
    assert.equal((await call("/api/admin/partners")).status, 401);
    role = "user"; assert.equal((await call("/api/admin/partners", "GET", token)).status, 403);
    role = "admin"; assert.equal((await call("/api/admin/partners", "GET", token)).status, 200);
    assert.equal((await call("/api/lobbies/ABC123", "GET", guest)).status, 403);
    assert.equal((await call("/api/lobbies/ABC123", "GET", token)).status, 200);
    lobby.members.push({ memberId: "member", identityKey: "guest:outside", joinOrder: 2, displayName: "Guest", type: "guest" });
    assert.equal((await call("/api/lobbies/ABC123/filters", "PATCH", guest, { location: "Erie" })).status, 403);
    assert.equal((await call("/api/lobbies/ABC123/filters", "PATCH", token, { location: "Erie" })).status, 200);
    assert.equal((await call(`/api/users/${ownerId}`, "DELETE", token)).status, 200);
    assert.equal((await call(`/api/users/${ownerId}`, "GET", cookieFor(`user:${ownerId}`, -1))).status, 401);
    sessions.delete(createHash("sha256").update(token.split("=")[1]).digest("hex"));
    assert.equal((await call(`/api/users/${ownerId}`, "GET", token)).status, 401);
  } finally {
    Session.findOne = old.session; User.findById = old.user; User.find = old.users; Restaurant.findOne = old.restaurant; Restaurant.findOneAndDelete = old.del; Lobby.findOne = old.lobby; Lobby.findOneAndUpdate = old.lobbyUpdate; User.findByIdAndUpdate = old.profileUpdate; User.findByIdAndDelete = old.profileDelete; Session.deleteMany = old.sessionDelete; delete process.env.JWT_SECRET;
    cleanupModels.forEach((model, index) => { model.deleteMany = cleanupDelete[index] as any; });
    SavedGroup.updateMany = groupUpdate;
    await new Promise<void>((r, j) => server.close(e => e ? j(e) : r()));
  }
});

