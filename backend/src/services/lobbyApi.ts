import { Router, type Request, type Response, type NextFunction } from "express";
import { randomInt, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { Lobby } from "../models/lobby";
import { GroupchatMessage } from "../models/groupchat";
import { establishSession, publicUser, revokeSession } from "./session";
import { changeLobby, findLobby, HttpError, lobbyEvents, memberFor, nextOnline, requireHost, serializeLobby, type Member } from "./lobbyState";

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     lobbySession:
 *       type: apiKey
 *       in: cookie
 *       name: forkoff_session
 *   schemas:
 *     LobbyFilters:
 *       type: object
 *       properties:
 *         location: { type: string, maxLength: 120 }
 *         dinnerAt: { type: string, format: date-time }
 *         maxDistance: { type: number, minimum: 1, maximum: 100 }
 *         minimumRating: { type: number, minimum: 0, maximum: 5 }
 *         categories: { type: array, items: { type: string }, maxItems: 20 }
 *         priceLevels: { type: array, items: { type: string, enum: ["$", "$$", "$$$"] } }
 *         diningNeeds: { type: array, items: { type: string }, maxItems: 10 }
 *         openNow: { type: boolean }
 * /api/auth/session:
 *   get:
 *     summary: Restore the verified user session; user is null for guests or anonymous clients.
 *     tags: [auth]
 *     responses:
 *       200: { description: Current user and identity type. }
 * /api/auth/logout:
 *   post:
 *     summary: Revoke the session and its socket connections.
 *     tags: [auth]
 *     responses:
 *       200: { description: Session revoked. }
 * /api/lobbies:
 *   post:
 *     summary: Create a lobby and join as its host; guests supply displayName.
 *     tags: [lobby]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - { $ref: '#/components/schemas/LobbyFilters' }
 *               - type: object
 *                 required: [location, dinnerAt]
 *                 properties:
 *                   name: { type: string, maxLength: 120 }
 *                   displayName: { type: string, maxLength: 40 }
 *     responses:
 *       201: { description: Lobby snapshot with hostMemberId, ordered members, selfMemberId, isHost and filters. }
 * /api/lobbies/{id}:
 *   parameters: [{ in: path, name: id, required: true, schema: { type: string }, description: MongoDB ID or invitation code. }]
 *   get:
 *     summary: Get the current lobby snapshot as a member.
 *     tags: [lobby]
 *     security: [{ lobbySession: [] }]
 *     responses:
 *       200: { description: Lobby snapshot. }
 *       403: { description: Current identity has not joined. }
 *   patch:
 *     summary: Host-only update of name or status.
 *     tags: [lobby]
 *     security: [{ lobbySession: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { name: { type: string }, status: { type: string, enum: [waiting, playing, finished] } } } } }
 *     responses:
 *       200: { description: Updated lobby in lobby property. }
 *       403: { description: Host permission required. }
 *   delete:
 *     summary: Host-only deletion of lobby, chat, and votes.
 *     tags: [lobby]
 *     security: [{ lobbySession: [] }]
 *     responses:
 *       200: { description: Lobby deleted. }
 * /api/lobbies/{id}/join:
 *   post:
 *     summary: Join by session identity; guests supply displayName, accounts use their username.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { displayName: { type: string, maxLength: 40 } } } } }
 *     responses:
 *       200: { description: Joined lobby snapshot; repeat joins keep the same membership. }
 * /api/lobbies/{id}/leave:
 *   post:
 *     summary: Leave as the current member and promote the earliest joined online successor if needed.
 *     tags: [lobby]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Left; empty lobbies and related records are deleted. }
 * /api/lobbies/{id}/members:
 *   get:
 *     summary: Get ordered lobby members, presence and hostMemberId.
 *     tags: [lobby]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Members returned. }
 * /api/lobbies/{id}/filters:
 *   parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *   get:
 *     summary: Read saved lobby filters as a member.
 *     tags: [lobby]
 *     security: [{ lobbySession: [] }]
 *     responses:
 *       200: { description: Filters returned. }
 *   patch:
 *     summary: Host-only partial update of filters.
 *     tags: [lobby]
 *     security: [{ lobbySession: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { $ref: '#/components/schemas/LobbyFilters' } } }
 *     responses:
 *       200: { description: Updated lobby in lobby property. }
 * /api/lobbies/{id}/messages:
 *   parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *   get:
 *     summary: Read the latest 50 messages or page backward using before.
 *     tags: [group-chat]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: query, name: before, schema: { type: string } }]
 *     responses:
 *       200: { description: Chronological messages and nextCursor, or null when exhausted. }
 *   post:
 *     summary: Save a message as the current member; retries reuse requestId.
 *     tags: [group-chat]
 *     security: [{ lobbySession: [] }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [text, requestId], properties: { text: { type: string, minLength: 1, maxLength: 2000 }, requestId: { type: string, maxLength: 80 } } } } }
 *     responses:
 *       201: { description: Saved message; duplicate retries return the same ID. }
 */
const router = Router();
const run = (handler: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { handler(req, res).catch(next); };
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
function reject(message: string): never { throw new HttpError(400, message); }
function bodyObject(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) reject("A JSON object is required.");
  return req.body;
}
function shortString(value: unknown, key: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) reject(`${key} must be between 1 and ${max} characters.`);
  return (value as string).trim();
}
function filtersFrom(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  const allowed = ["location", "dinnerAt", "maxDistance", "minimumRating", "categories", "openNow", "priceLevels", "diningNeeds"];
  if (!Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) reject("Provide supported lobby filters only.");
  for (const [key, value] of Object.entries(body)) {
    if (key === "location") result[key] = shortString(value, key, 120);
    else if (key === "dinnerAt") {
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now()) reject("Choose a dinner time in the future.");
      result[key] = new Date(value as string);
    } else if (key === "maxDistance" || key === "minimumRating") {
      const [min, max] = key === "maxDistance" ? [1, 100] : [0, 5];
      if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) reject(`${key} must be between ${min} and ${max}.`);
      result[key] = value;
    } else if (key === "openNow") {
      if (typeof value !== "boolean") reject("openNow must be a boolean.");
      result[key] = value;
    } else {
      if (!Array.isArray(value)) reject(`${key} must be an array.`);
      const values = value as unknown[];
      const limit = key === "categories" ? 20 : key === "priceLevels" ? 3 : 10;
      if (values.length > limit) reject(`Too many ${key}.`);
      result[key] = [...new Set(values.map(item => {
        const text = shortString(item, key, key === "diningNeeds" ? 60 : 40);
        if (key === "priceLevels" && !["$", "$$", "$$$"].includes(text)) reject("priceLevels may only contain $, $$, or $$$.");
        return text;
      }))];
    }
  }
  return result;
}
async function newMember(req: Request, res: Response, body: Record<string, unknown>): Promise<Member> {
  if (body.userId !== undefined || body.guestId !== undefined || body.hostId !== undefined || body.hostID !== undefined) reject("Identity is established by your session, not request IDs.");
  const displayName = req.identity?.userId ? req.identity.username! : shortString(body.displayName, "Guest display name", 40);
  if (!req.identity) await establishSession(req, res);
  return {
    memberId: randomUUID(), identityKey: req.identity!.key,
    ...(req.identity!.userId ? { userId: new mongoose.Types.ObjectId(req.identity!.userId) } : {}),
    type: req.identity!.userId ? "user" : "guest", displayName, joinOrder: 0, joinedAt: new Date(),
  };
}
router.get("/api/auth/session", (req, res) => {
  res.set("Cache-Control", "no-store").json({ user: publicUser(req.identity), identityType: req.identity ? (req.identity.userId ? "user" : "guest") : null });
});
router.post("/api/auth/logout", run(async (req, res) => {
  await revokeSession(req.headers.cookie);
  res.clearCookie("forkoff_session", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
  res.json({ message: "Logged out." });
}));

router.post("/api/lobbies", run(async (req, res) => {
  const body = bodyObject(req);
  const filterKeys = ["location", "dinnerAt", "maxDistance", "minimumRating", "categories", "openNow", "priceLevels", "diningNeeds"];
  if (Object.keys(body).some(key => ![...filterKeys, "name", "displayName"].includes(key))) reject("Unsupported lobby field.");
  const filterBody = Object.fromEntries(filterKeys.filter(key => key in body).map(key => [key, body[key]]));
  const filters = filtersFrom(filterBody);
  if (!filters.location || !filters.dinnerAt) reject("Location and dinner time are required.");
  if (filters.openNow === undefined && Array.isArray(filters.diningNeeds)) filters.openNow = filters.diningNeeds.includes("Open at dining time");
  const name = body.name === undefined ? `Dinner in ${filters.location}` : shortString(body.name, "name", 120);
  const member = await newMember(req, res, body);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const lobby = await Lobby.create({ lobbyCode: code(), name, hostMemberId: member.memberId, members: [member], nextJoinOrder: 1, revision: 0, status: "waiting", filters });
      return res.status(201).json({ lobby: serializeLobby(lobby as never, req.identity) });
    } catch (error) {
      if ((error as { code?: number }).code === 11000 && attempt < 4) continue;
      throw error;
    }
  }
}));

router.post("/api/lobbies/:id/join", run(async (req, res) => {
  const body = bodyObject(req);
  // Verify the invitation before establishing a new guest session.
  await findLobby(String(req.params.id));
  const candidate = await newMember(req, res, body);
  const lobby = await changeLobby(String(req.params.id), current => {
    if (current.members.some(member => member.identityKey === candidate.identityKey)) return;
    if (current.status !== "waiting") throw new HttpError(409, "This lobby is no longer accepting new members.");
    candidate.joinOrder = current.nextJoinOrder++;
    current.members.push(candidate);
  });
  return res.json({ lobby: serializeLobby(lobby!, req.identity), member: serializeLobby(lobby!, req.identity).selfMemberId });
}));

router.get("/api/lobbies/:id", run(async (req, res) => {
  const lobby = await findLobby(String(req.params.id)); memberFor(lobby, req.identity);
  res.json(serializeLobby(lobby, req.identity));
}));
router.get("/api/lobbies/:id/members", run(async (req, res) => {
  const lobby = await findLobby(String(req.params.id)); memberFor(lobby, req.identity);
  res.json({ lobbyId: String(lobby._id), members: serializeLobby(lobby, req.identity).members, hostMemberId: lobby.hostMemberId });
}));
router.get("/api/lobbies/:id/filters", run(async (req, res) => {
  const lobby = await findLobby(String(req.params.id)); memberFor(lobby, req.identity);
  res.json({ lobbyId: String(lobby._id), filters: lobby.filters });
}));
router.patch("/api/lobbies/:id", run(async (req, res) => {
  requireHost(await findLobby(String(req.params.id)), req.identity);
  const body = bodyObject(req);
  if (!Object.keys(body).length || Object.keys(body).some(key => !["name", "status"].includes(key))) reject("Provide name and/or status only.");
  const name = body.name === undefined ? undefined : shortString(body.name, "name", 120);
  if (body.status !== undefined && !["waiting", "playing", "finished"].includes(String(body.status))) reject("Invalid lobby status.");
  const lobby = await changeLobby(String(req.params.id), current => {
    requireHost(current, req.identity);
    if (name !== undefined) current.name = name;
    if (body.status !== undefined) current.status = body.status as "waiting" | "playing" | "finished";
  });
  res.json({ lobby: serializeLobby(lobby!, req.identity) });
}));
router.patch("/api/lobbies/:id/filters", run(async (req, res) => {
  requireHost(await findLobby(String(req.params.id)), req.identity);
  const filters = filtersFrom(bodyObject(req));
  const lobby = await changeLobby(String(req.params.id), current => {
    requireHost(current, req.identity);
    current.filters = { ...JSON.parse(JSON.stringify(current.filters)), ...filters };
  });
  res.json({ lobby: serializeLobby(lobby!, req.identity) });
}));
router.post("/api/lobbies/:id/leave", run(async (req, res) => {
  const lobby = await changeLobby(String(req.params.id), current => {
    const member = memberFor(current, req.identity);
    current.members = current.members.filter(value => value.memberId !== member.memberId);
    if (!current.members.length) return "delete";
    if (current.hostMemberId === member.memberId) current.hostMemberId = nextOnline(current)?.memberId ?? null;
  });
  res.json({ message: "You left the lobby.", deleted: !lobby });
}));
router.delete("/api/lobbies/:id", run(async (req, res) => {
  await changeLobby(String(req.params.id), current => { requireHost(current, req.identity); return "delete"; });
  res.json({ message: "Lobby deleted." });
}));

function serializeMessage(message: { _id: unknown; memberId: string; senderName: string; text: string; createdAt: Date; requestId: string }) {
  return { id: String(message._id), memberId: message.memberId, senderName: message.senderName, text: message.text, createdAt: message.createdAt, requestId: message.requestId };
}
router.get("/api/lobbies/:id/messages", run(async (req, res) => {
  const lobby = await findLobby(String(req.params.id)); memberFor(lobby, req.identity);
  const before = req.query.before;
  if (before !== undefined && (typeof before !== "string" || !mongoose.isValidObjectId(before))) reject("Invalid message cursor.");
  const messages = await GroupchatMessage.find({ lobbyId: lobby._id, ...(before ? { _id: { $lt: before } } : {}) }).sort({ _id: -1 }).limit(51).lean();
  const hasMore = messages.length > 50;
  const page = messages.slice(0, 50);
  res.json({ messages: page.reverse().map(serializeMessage), nextCursor: hasMore ? String(page[0]._id) : null });
}));
router.post("/api/lobbies/:id/messages", run(async (req, res) => {
  const lobby = await findLobby(String(req.params.id)); const member = memberFor(lobby, req.identity);
  const body = bodyObject(req);
  const text = shortString(body.text, "Message", 2000);
  const requestId = shortString(body.requestId, "requestId", 80);
  if (!/^[\w-]+$/.test(requestId)) reject("Invalid requestId.");
  const message = await GroupchatMessage.findOneAndUpdate(
    { lobbyId: lobby._id, memberId: member.memberId, requestId },
    { $setOnInsert: { senderName: member.displayName, text } },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  // If deletion won the race with the send, do not leave an orphan message.
  if (!await Lobby.exists({ _id: lobby._id, "members.memberId": member.memberId })) {
    await GroupchatMessage.deleteOne({ _id: message._id });
    throw new HttpError(403, "You are no longer in this lobby.");
  }
  const value = serializeMessage(message);
  lobbyEvents.emit("message", String(lobby._id), value);
  res.status(201).json({ message: value });
}));

// These remain demo responses, but are still private to lobby members.
router.use("/api/lobbies/:id", (req, _res, next) => {
  findLobby(String(req.params.id)).then(lobby => { memberFor(lobby, req.identity); next(); }).catch(next);
});

export default router;
