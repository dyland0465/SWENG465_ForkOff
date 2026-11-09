import { Router, type Request, type Response, type NextFunction } from "express";
import { Restaurant } from "../db_models/restaurant";
import { restaurantFilter, requireManagedRestaurant } from "../middleware/restaurantAccess";
import { HttpError } from "../utils/errors";
import { AnalyticsEvent, AnalyticsMetadata, AnalyticsRound } from "../db_models/telemetry";
import { Favorite, RestaurantCollection } from "../db_models/saved";

const router = Router();
const run = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
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
  const restaurant = await requireManagedRestaurant(req);
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
  const restaurant = await Restaurant.findOne(restaurantFilter(String(req.params.id))).lean();
  if (!restaurant) throw new HttpError(404, "Restaurant not found.");
  res.json({ restaurantId: String(restaurant._id), menu: restaurant.menu ?? null });
}));
router.patch("/api/restaurants/:id/menu", run(async (req, res) => {
  const restaurant = await requireManagedRestaurant(req);
  if (!plain(req.body) || Object.keys(req.body).length !== 1 || !plain(req.body.menu)) throw new HttpError(400, "Provide a menu object.");
  restaurant.menu = req.body.menu;
  await restaurant.save();
  res.json({ restaurantId: String(restaurant._id), menu: restaurant.menu });
}));

/** @swagger
 * /api/restaurants/{id}/analytics:
 *   get:
 *     summary: Read historical restaurant analytics (approved owner or admin).
 *     description: Date bounds are inclusive UTC dates, with a maximum range of 366 days.
 *     tags: [restaurant]
 *     security: [{ lobbySession: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Period totals, daily buckets, previous-period totals and current saved counts. }
 *       401: { description: Login required. }
 *       403: { description: Owner or admin required. }
 *       404: { description: Restaurant not found. }
 */
router.get("/api/restaurants/:id/analytics", run(async (req, res) => {
  const restaurant = await requireManagedRestaurant(req);
  const parse = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value ? new Date(`${value}T00:00:00Z`) : null;
  const today = new Date().toISOString().slice(0, 10);
  const end = parse(req.query.end ?? today);
  const start = parse(req.query.start ?? new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10));
  if (!start || !end || end < start || end.getTime() - start.getTime() > 365 * 86400000) throw new HttpError(400, "Choose a valid date range of at most 366 days.");
  const endExclusive = new Date(end.getTime() + 86400000);
  const days = (endExclusive.getTime() - start.getTime()) / 86400000;
  const previousStart = new Date(start.getTime() - days * 86400000);
  const [rounds, events, favorites, collections, metadata] = await Promise.all([
    AnalyticsRound.find({ "restaurants.placeId": restaurant.placeId, $or: [{ startedAt: { $gte: previousStart, $lt: endExclusive } }, { endedAt: { $gte: previousStart, $lt: endExclusive } }] }).lean(),
    AnalyticsEvent.find({ placeId: restaurant.placeId, occurredAt: { $gte: previousStart, $lt: endExclusive } }).lean(),
    Favorite.countDocuments({ placeId: restaurant.placeId }), RestaurantCollection.countDocuments({ placeIds: restaurant.placeId }),
    AnalyticsMetadata.findOne({ key: "collection" }).lean(),
  ]);
  const empty = () => ({ appearances: 0, completed: 0, abandoned: 0, yes: 0, no: 0, veto: 0, skip: 0, topThree: 0, first: 0, ties: 0, vetoed: 0, cardViews: 0, mapsClicks: 0, favoriteAdds: 0, favoriteRemoves: 0, collectionAdds: 0, collectionRemoves: 0 });
  type Totals = ReturnType<typeof empty>;
  const totals = empty(), previous = empty();
  const buckets = new Map<string, Totals>();
  const target = (date: Date) => {
    if (date < start) return previous;
    const day = date.toISOString().slice(0, 10);
    if (!buckets.has(day)) buckets.set(day, empty());
    return buckets.get(day)!;
  };
  for (const round of rounds) {
    const row = (round.restaurants as any[]).find(item => item.placeId === restaurant.placeId);
    const began = new Date(round.startedAt);
    if (began >= previousStart && began < endExclusive) target(began).appearances++;
    if (!round.endedAt) continue;
    const ended = new Date(round.endedAt);
    if (ended < previousStart || ended >= endExclusive) continue;
    const out = target(ended);
    if (round.status === "abandoned") out.abandoned++;
    if (round.status === "completed") {
      out.completed++; for (const key of ["yes", "no", "veto", "skip"] as const) out[key] += row[key] ?? 0;
      if (row.rank && row.rank <= 3) out.topThree++;
      if (row.rank === 1) out.first++;
      if (row.tied) out.ties++;
      if (row.vetoed) out.vetoed++;
    }
  }
  const eventFields: Record<string, keyof Totals> = { card_view: "cardViews", maps_click: "mapsClicks", favorite_add: "favoriteAdds", favorite_remove: "favoriteRemoves", collection_add: "collectionAdds", collection_remove: "collectionRemoves" };
  for (const event of events) { const key = eventFields[event.kind]; if (key) target(new Date(event.occurredAt))[key]++; }
  for (const bucket of buckets.values()) for (const key of Object.keys(totals) as (keyof Totals)[]) totals[key] += bucket[key];
  res.json({ restaurantId: String(restaurant._id), restaurantName: (restaurant.partnerDetails as any)?.restaurantName ?? (restaurant.cachedPlace as any)?.displayName?.text ?? "Restaurant name unavailable",
    start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), collectionStartedAt: metadata?.startedAt ?? null,
    totals, previous, current: { favorites, collections }, buckets: [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...values })) });
}));
export default router;
