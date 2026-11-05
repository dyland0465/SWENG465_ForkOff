import { Router, type Request, type Response, type NextFunction } from "express";
import mongoose from "mongoose";
import { randomBytes, createHash } from "node:crypto";
import { Favorite, RestaurantCollection, SavedGroup, GroupInvitation, CollectionShare } from "../db_models/saved";
import { Lobby } from "../db_models/lobby";
import { findLobby, requireHost } from "../services/lobbyState";
import { HttpError } from "../utils/errors";
const router = Router();
const run = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
function user(req: Request) { if (!req.identity?.userId) throw new HttpError(401, "Sign in to use saved items."); return req.identity.userId; }
function objectId(value: unknown) { if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) throw new HttpError(400, "Invalid ID."); return value; }
function name(value: unknown) { if (typeof value !== "string" || !value.trim() || value.trim().length > 80) throw new HttpError(400, "Name must be 1 to 80 characters."); return value.trim(); }
function place(value: unknown) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,300}$/.test(value)) throw new HttpError(400, "Invalid Google Place ID."); return value; }
async function collection(req: Request) { const result = await RestaurantCollection.findOne({ _id: objectId(req.params.id), userId: user(req) }); if (!result) throw new HttpError(404, "Collection not found."); return result; }
async function group(req: Request) { const result = await SavedGroup.findOne({ _id: objectId(req.params.id), ownerId: user(req) }); if (!result) throw new HttpError(404, "Group not found."); return result; }

/** @swagger
 * /api/saved/favorites:
 *   get:
 *     summary: List your favorited Google Place IDs.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Saved Place IDs. }, 401: { description: Login required. } }
 * /api/saved/favorites/{placeId}:
 *   parameters: [{ in: path, name: placeId, required: true, schema: { type: string } }]
 *   put:
 *     summary: Favorite a restaurant.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Favorite saved. }, 401: { description: Login required. } }
 *   delete:
 *     summary: Remove a favorite.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Favorite removed. }, 401: { description: Login required. } }
 */
router.get("/api/saved/favorites", run(async (req, res) => { const items = await Favorite.find({ userId: user(req) }).sort({ createdAt: -1 }).lean(); res.json({ placeIds: items.map(x => x.placeId) }); }));
router.put("/api/saved/favorites/:placeId", run(async (req, res) => { const userId = user(req), placeId = place(req.params.placeId); await Favorite.updateOne({ userId, placeId }, { $setOnInsert: { userId, placeId } }, { upsert: true }); res.json({ placeId, favorite: true }); }));
router.delete("/api/saved/favorites/:placeId", run(async (req, res) => { const placeId = place(req.params.placeId); await Favorite.deleteOne({ userId: user(req), placeId }); res.json({ placeId, favorite: false }); }));

/** @swagger
 * /api/saved/collections:
 *   get:
 *     summary: List your restaurant collections.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Collections. }, 401: { description: Login required. } }
 *   post:
 *     summary: Create a restaurant collection.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [name], properties: { name: { type: string, maxLength: 80 } } } } } }
 *     responses: { 201: { description: Collection created. }, 401: { description: Login required. } }
 * /api/saved/collections/{id}:
 *   parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *   delete:
 *     summary: Delete your collection.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Collection deleted. }, 404: { description: Not found. } }
 * /api/saved/collections/{id}/restaurants/{placeId}:
 *   parameters: [{ in: path, name: id, required: true, schema: { type: string } }, { in: path, name: placeId, required: true, schema: { type: string } }]
 *   put:
 *     summary: Add a restaurant to your collection.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Updated collection. }, 404: { description: Not found. } }
 *   delete:
 *     summary: Remove a restaurant from your collection.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Updated collection. }, 404: { description: Not found. } }
 */
router.get("/api/saved/collections", run(async (req, res) => { res.json({ collections: await RestaurantCollection.find({ userId: user(req) }).sort({ createdAt: -1 }).lean() }); }));
router.post("/api/saved/collections", run(async (req, res) => { const c = await RestaurantCollection.create({ userId: user(req), name: name(req.body?.name) }); res.status(201).json({ collection: c }); }));
router.delete("/api/saved/collections/:id", run(async (req, res) => { const c = await collection(req); await c.deleteOne(); await CollectionShare.deleteMany({ collectionId: c._id }); res.json({ ok: true }); }));
router.put("/api/saved/collections/:id/restaurants/:placeId", run(async (req, res) => { const userId = user(req), id = objectId(req.params.id), placeId = place(req.params.placeId); const c = await RestaurantCollection.findOneAndUpdate({ _id: id, userId, $or: [{ placeIds: placeId }, { "placeIds.199": { $exists: false } }] }, { $addToSet: { placeIds: placeId } }, { returnDocument: "after" }); if (!c) throw new HttpError(404, "Collection not found or full."); res.json({ collection: c }); }));
router.delete("/api/saved/collections/:id/restaurants/:placeId", run(async (req, res) => { const c = await RestaurantCollection.findOneAndUpdate({ _id: objectId(req.params.id), userId: user(req) }, { $pull: { placeIds: place(req.params.placeId) } }, { returnDocument: "after" }); if (!c) throw new HttpError(404, "Collection not found."); res.json({ collection: c }); }));

/** @swagger
 * /api/saved/collections/{id}/share:
 *   post:
 *     summary: Create a seven-day share link for your collection.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 201: { description: Share token and expiry. }, 404: { description: Collection not found. } }
 * /api/saved/shares/{token}:
 *   get:
 *     summary: Preview a shared collection while signed in.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: token, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Collection preview. }, 404: { description: Link invalid or expired. } }
 *   post:
 *     summary: Import a personal copy of a shared collection.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: token, required: true, schema: { type: string } }]
 *     responses: { 201: { description: Imported collection. }, 404: { description: Link invalid or expired. } }
 */
router.post("/api/saved/collections/:id/share", run(async (req, res) => {
  const ownerId = user(req), c = await collection(req), token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await CollectionShare.create({ ownerId, collectionId: c._id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt });
  res.status(201).json({ token, expiresAt });
}));
async function shared(req: Request) {
  user(req);
  const token = req.params.token;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, "Share link not found or expired.");
  const share = await CollectionShare.findOne({ tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: { $gt: new Date() } }).lean();
  if (!share) throw new HttpError(404, "Share link not found or expired.");
  const c = await RestaurantCollection.findOne({ _id: share.collectionId, userId: share.ownerId }).lean();
  if (!c) throw new HttpError(404, "Share link not found or expired.");
  return c;
}
router.get("/api/saved/shares/:token", run(async (req, res) => { const c = await shared(req); res.json({ name: c.name, placeIds: c.placeIds }); }));
router.post("/api/saved/shares/:token", run(async (req, res) => { const userId = user(req), source = await shared(req); const imported = await RestaurantCollection.create({ userId, name: source.name, placeIds: source.placeIds }); res.status(201).json({ collection: imported }); }));

/** @swagger
 * /api/saved/groups:
 *   get:
 *     summary: List groups you saved.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Groups. }, 401: { description: Login required. } }
 *   post:
 *     summary: Save signed-in members of a lobby you host; guest members are excluded.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [name, lobbyId], properties: { name: { type: string }, lobbyId: { type: string } } } } } }
 *     responses: { 201: { description: Group saved. }, 403: { description: Host required. } }
 * /api/saved/groups/{id}:
 *   delete:
 *     summary: Delete a saved group you own.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Group deleted. }, 404: { description: Not found. } }
 * /api/saved/groups/{id}/invitations:
 *   post:
 *     summary: Invite group members to a waiting lobby you host.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [lobbyId], properties: { lobbyId: { type: string } } } } } }
 *     responses: { 200: { description: Invitations created. }, 403: { description: Host required. } }
 * /api/saved/invitations:
 *   get:
 *     summary: List your current group lobby invitations.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     responses: { 200: { description: Pending invitations. }, 401: { description: Login required. } }
 * /api/saved/invitations/{id}:
 *   delete:
 *     summary: Decline your invitation.
 *     tags: [saved]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Invitation declined. }, 404: { description: Not found. } }
 */
router.get("/api/saved/groups", run(async (req, res) => { res.json({ groups: await SavedGroup.find({ ownerId: user(req) }).sort({ createdAt: -1 }).lean() }); }));
router.post("/api/saved/groups", run(async (req, res) => { const ownerId = user(req); const lobby = await findLobby(String(req.body?.lobbyId ?? "")); requireHost(lobby, req.identity); const members = lobby.members.filter(m => m.userId && String(m.userId) !== ownerId).map(m => ({ userId: m.userId, displayName: m.displayName })); if (members.length > 100) throw new HttpError(400, "Groups can have at most 100 other members."); const saved = await SavedGroup.create({ ownerId, name: name(req.body?.name), members }); res.status(201).json({ group: saved, excludedGuests: lobby.members.filter(m => m.type === "guest").length }); }));
router.delete("/api/saved/groups/:id", run(async (req, res) => { const g = await group(req); await g.deleteOne(); await GroupInvitation.deleteMany({ groupId: g._id }); res.json({ ok: true }); }));
router.post("/api/saved/groups/:id/invitations", run(async (req, res) => { const g = await group(req), lobby = await findLobby(String(req.body?.lobbyId ?? "")); requireHost(lobby, req.identity); if (lobby.status !== "waiting") throw new HttpError(409, "Lobby is not accepting members."); const members = g.members.filter(m => !lobby.members.some(x => String(x.userId ?? "") === String(m.userId))); const expiresAt = new Date(Date.now() + 7 * 86400000); if (members.length) await GroupInvitation.bulkWrite(members.map(m => ({ updateOne: { filter: { groupId: g._id, lobbyId: lobby._id, recipientId: m.userId }, update: { $setOnInsert: { status: "pending", expiresAt, senderId: g.ownerId } }, upsert: true } }))); res.json({ invited: members.length }); }));
router.get("/api/saved/invitations", run(async (req, res) => { const invites = await GroupInvitation.find({ recipientId: user(req), status: "pending", expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean(); const lobbyIds = invites.map(i => i.lobbyId); const lobbies = await Lobby.find({ _id: { $in: lobbyIds }, status: "waiting" }).select("name lobbyCode").lean(); const map = new Map(lobbies.map(l => [String(l._id), l])); res.json({ invitations: invites.flatMap(i => { const l = map.get(String(i.lobbyId)); return l ? [{ id: String(i._id), lobbyId: String(l._id), lobbyName: l.name, lobbyCode: l.lobbyCode }] : []; }) }); }));
router.delete("/api/saved/invitations/:id", run(async (req, res) => { const result = await GroupInvitation.findOneAndUpdate({ _id: objectId(req.params.id), recipientId: user(req), status: "pending" }, { $set: { status: "declined" } }); if (!result) throw new HttpError(404, "Invitation not found."); res.json({ ok: true }); }));
export default router;
