import { Router, type Request, type Response, type NextFunction } from "express";
import mongoose from "mongoose";
import { Restaurant } from "../db_models/restaurant";
import { Lobby } from "../db_models/lobby";
import { HttpError } from "../utils/errors";

const router = Router();
const run = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
const idFilter = (id: string) => mongoose.isObjectIdOrHexString(id)
  ? { $or: [{ placeId: id }, { _id: new mongoose.Types.ObjectId(id) }] } : { placeId: id };
async function owned(req: Request) {
  if (!req.identity?.userId) throw new HttpError(401, "Login is required.");
  const restaurant = await Restaurant.findOne(idFilter(String(req.params.id)));
  if (!restaurant) throw new HttpError(404, "Restaurant not found.");
  const identity = req.identity;
  if (identity.role !== "admin" && !(identity.role === "partner" && identity.partnerStatus === "approved" && identity.restaurantIds?.includes(String(restaurant._id))))
    throw new HttpError(403, "Only an approved owner or an admin can manage this restaurant.");
  return restaurant;
}
function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/** @swagger
 * /api/restaurants/{id}:
 *   patch:
 *     summary: Update app-managed restaurant details (approved owner or admin).
 *     description: These values are stored by ForkOff and do not edit Google Maps.
 *     tags: [restaurant]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { restaurantName: { type: string }, address: { type: string }, phone: { type: string }, website: { type: string }, categories: { type: array, items: { type: string } } } } } }
 *     responses:
 *       200: { description: Saved app-managed details. }
 *       400: { description: Invalid details. }
 *       401: { description: Login required. }
 *       403: { description: Owner or admin required. }
 *       404: { description: Restaurant not found. }
 */
router.patch("/api/restaurants/:id", run(async (req, res) => {
  const restaurant = await owned(req);
  if (!plain(req.body) || !Object.keys(req.body).length) throw new HttpError(400, "Provide restaurant details.");
  const fields = ["restaurantName", "address", "phone", "website", "categories"];
  const details = { ...(restaurant.partnerDetails ?? {}) } as Record<string, unknown>;
  for (const [key, value] of Object.entries(req.body)) {
    if (!fields.includes(key)) throw new HttpError(400, "Unsupported restaurant field.");
    if (key === "categories") {
      if (!Array.isArray(value) || value.length > 20 || value.some(x => typeof x !== "string" || !x.trim() || x.length > 100)) throw new HttpError(400, "Invalid categories.");
      details[key] = value.map(x => x.trim());
    } else {
      if (typeof value !== "string" || !value.trim() || value.length > 500) throw new HttpError(400, `Invalid ${key}.`);
      if (key === "website") { try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol)) throw Error(); } catch { throw new HttpError(400, "Invalid website URL."); } }
      details[key] = value.trim();
    }
  }
  restaurant.partnerDetails = details;
  await restaurant.save();
  res.json({ restaurantId: String(restaurant._id), details });
}));

/** @swagger
 * /api/restaurants/{id}/menu:
 *   get:
 *     summary: Read the ForkOff menu for a saved restaurant.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Saved menu, or null when none exists. }
 *       404: { description: Restaurant not found. }
 *   patch:
 *     summary: Replace the ForkOff menu (approved owner or admin).
 *     tags: [restaurant]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [menu], properties: { menu: { type: object } } } } }
 *     responses:
 *       200: { description: Menu saved. }
 *       400: { description: Invalid menu. }
 *       401: { description: Login required. }
 *       403: { description: Owner or admin required. }
 *       404: { description: Restaurant not found. }
 */
router.get("/api/restaurants/:id/menu", run(async (req, res) => {
  const restaurant = await Restaurant.findOne(idFilter(String(req.params.id))).lean();
  if (!restaurant) throw new HttpError(404, "Restaurant not found.");
  res.json({ restaurantId: String(restaurant._id), menu: restaurant.menu ?? null });
}));
router.patch("/api/restaurants/:id/menu", run(async (req, res) => {
  const restaurant = await owned(req);
  if (!plain(req.body) || Object.keys(req.body).length !== 1 || !plain(req.body.menu)) throw new HttpError(400, "Provide a menu object.");
  restaurant.menu = req.body.menu;
  await restaurant.save();
  res.json({ restaurantId: String(restaurant._id), menu: restaurant.menu });
}));

/** @swagger
 * /api/restaurants/{id}/analytics:
 *   get:
 *     summary: Count decisions in currently active lobby rounds (approved owner or admin).
 *     description: These counts are a live snapshot, not historical analytics; ended rounds are not retained.
 *     tags: [restaurant]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Counts of current yes, no, veto and skip decisions. }
 *       401: { description: Login required. }
 *       403: { description: Owner or admin required. }
 *       404: { description: Restaurant not found. }
 */
router.get("/api/restaurants/:id/analytics", run(async (req, res) => {
  const restaurant = await owned(req);
  const rounds = await Lobby.find({ "round.restaurants.id": restaurant.placeId }).select({ round: 1 }).lean();
  const counts = { yes: 0, no: 0, veto: 0, skip: 0 };
  for (const lobby of rounds) {
    const round = lobby.round as { decisions?: Record<string, Record<string, string>> } | null;
    for (const decisions of Object.values(round?.decisions ?? {})) {
      const vote = decisions[restaurant.placeId];
      if (vote === "yes" || vote === "no" || vote === "veto" || vote === "skip") counts[vote]++;
    }
  }
  res.json({ restaurantId: String(restaurant._id), scope: "active-rounds", rounds: rounds.length, decisions: counts });
}));
export default router;
