/**
 * restaurantRoutes.ts
 *
 * Restaurants saved in MongoDB, including a seven-day search cache:
 *  - GET    /api/restaurants         list saved restaurants
 *  - GET    /api/restaurants/:id     one restaurant
 *  - POST   /api/restaurants/import  search Google and save the results
 *  - DELETE /api/restaurants/:id     remove a saved restaurant
 * Partner-managed details, menus, and live analytics are in restaurantManagementRoutes.ts.
 */
import { Router } from "express";
import mongoose from "mongoose";
import { Restaurant } from "../db_models/restaurant";
import { getGooglePlace, searchRestaurants } from "../services/googlePlaces";
import { requireManagedRestaurant } from "../middleware/restaurantAccess";
import { handlePlacesError } from "../utils/errors";

const router = Router();

/** @swagger
 * /api/restaurant-photos/{placeId}:
 *   get:
 *     summary: Get a cached restaurant photo.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: placeId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cached image. }
 *       404: { description: No cached image. }
 */
router.get('/api/restaurant-photos/:placeId', async (req, res, next) => {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const restaurant = await Restaurant.findOne({ placeId: req.params.placeId, cachedAt: { $gt: cutoff } }).select('+cachedPhoto cachedPhotoType');
    if (!restaurant?.cachedPhoto || !restaurant.cachedPhotoType) return res.status(404).end();
    res.type(restaurant.cachedPhotoType).send(restaurant.cachedPhoto);
  } catch (error) { next(error); }
});

/** @swagger
 * /api/restaurants/search:
 *   get:
 *     summary: Search restaurant records already in the database.
 *     tags: [restaurant]
 *     parameters:
 *       - { in: query, name: q, schema: { type: string, maxLength: 120 } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
 *     responses:
 *       200: { description: Paginated restaurant records. }
 *       400: { description: Invalid search parameters. }
 */
router.get("/api/restaurants/search", async (req, res, next) => {
  try {
    if ((req.query.q !== undefined && typeof req.query.q !== "string") || (req.query.page !== undefined && typeof req.query.page !== "string")) {
      return res.status(400).json({ message: "Invalid search parameters." });
    }
    if (req.query.ids !== undefined && typeof req.query.ids !== "string") return res.status(400).json({ message: "Invalid restaurant IDs." });
    const ids = typeof req.query.ids === "string" ? (req.query.ids ? req.query.ids.split(",") : []) : undefined;
    if (ids && (ids.length > 200 || ids.some(id => !/^[A-Za-z0-9_-]{1,300}$/.test(id)))) return res.status(400).json({ message: "Invalid restaurant IDs." });
    const q = (req.query.q as string | undefined)?.trim() ?? "";
    const page = Number(req.query.page ?? 1);
    if (q.length > 120 || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
      return res.status(400).json({ message: "Invalid search parameters." });
    }
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const categoryTypes: Record<string, string[]> = {
      italian: ['italian_restaurant', 'pizza_restaurant'], ramen: ['ramen_restaurant'],
      mexican: ['mexican_restaurant'], american: ['american_restaurant'],
      asian: ['asian_restaurant', 'asian_fusion_restaurant', 'chinese_restaurant', 'japanese_restaurant', 'korean_restaurant', 'thai_restaurant', 'vietnamese_restaurant', 'indian_restaurant', 'ramen_restaurant', 'sushi_restaurant'],
      'fast food': ['fast_food_restaurant'], vegetarian: ['vegetarian_restaurant', 'vegan_restaurant'],
    };
    const priceTypes: Record<string, string> = { '$': 'PRICE_LEVEL_INEXPENSIVE', '$$': 'PRICE_LEVEL_MODERATE', '$$$': 'PRICE_LEVEL_EXPENSIVE' };
    if ((req.query.category !== undefined && (typeof req.query.category !== 'string' || !categoryTypes[req.query.category])) ||
        (req.query.price !== undefined && (typeof req.query.price !== 'string' || !priceTypes[req.query.price]))) {
      return res.status(400).json({ message: 'Invalid restaurant filter.' });
    }
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // One missing or mistyped character per word, with bounded pattern size.
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length > 8 || words.some(word => word.length > 32)) return res.status(400).json({ message: 'Use at most eight search words, each up to 32 characters.' });
    const fuzzy = (word: string) => {
      const chars = Array.from(word.slice(0, 32), escape);
      if (chars.length < 4) return chars.join('');
      return `(?:${chars.join('')}|${chars.map((_, i) => chars.map((c, j) => j === i ? '.?' : c).join('')).join('|')})`;
    };
    const conditions: Record<string, unknown>[] = [];
    if (ids) conditions.push({ placeId: { $in: ids } });
    for (const word of words) {
      const pattern = fuzzy(word);
      conditions.push({ $or: [
        { placeId: { $regex: escape(word), $options: 'i' } },
        { cachedAt: { $gt: cutoff }, 'cachedPlace.displayName.text': { $regex: pattern, $options: 'i' } },
        { cachedAt: { $gt: cutoff }, 'cachedPlace.formattedAddress': { $regex: pattern, $options: 'i' } },
        { cachedAt: { $gt: cutoff }, 'cachedPlace.types': { $regex: pattern, $options: 'i' } },
        { cachedAt: { $gt: cutoff }, 'cachedPlace.primaryType': { $regex: pattern, $options: 'i' } },
      ] });
    }
    if (typeof req.query.category === 'string') conditions.push({ cachedAt: { $gt: cutoff }, $or: [
      { 'cachedPlace.types': { $in: categoryTypes[req.query.category] } },
      { 'cachedPlace.primaryType': { $in: categoryTypes[req.query.category] } },
    ] });
    if (typeof req.query.price === 'string') conditions.push({ cachedAt: { $gt: cutoff }, 'cachedPlace.priceLevel': priceTypes[req.query.price] });
    const match = conditions.length ? { $and: conditions } : {};
    const pageSize = 20;
    const [items, total] = await Promise.all([
      Restaurant.find(match).sort({ _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).select({ placeId: 1, cachedAt: 1, cachedPlace: 1 }).lean(),
      Restaurant.countDocuments(match),
    ]);
    const restaurants = items.map(item => {
      const place = item.cachedAt && item.cachedAt > cutoff ? item.cachedPlace as { displayName?: { text?: string }; formattedAddress?: string; googleMapsUri?: string } | undefined : undefined;
      return { placeId: item.placeId, name: place?.displayName?.text ?? null, address: place?.formattedAddress ?? null, googleMapsUri: place?.googleMapsUri ?? null };
    });
    return res.json({ restaurants, total, page, pageSize, attribution: "Google Maps" });
  } catch (error) { return next(error); }
});

/** @swagger
 * /api/restaurants/{id}:
 *   get:
 *     summary: Get saved restaurant details by MongoDB ID or Google Place ID.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Restaurant information returned successfully. }
 *       404: { description: Restaurant not found. }
 *       502: { description: Google Places request failed. }
 */
router.get("/api/restaurants/:id", async (req, res) => {
  const id = req.params.id;
  const filter = mongoose.isValidObjectId(id)
    ? { $or: [{ placeId: id }, { _id: new mongoose.Types.ObjectId(id) }] }
    : { placeId: id };

  try {
    const savedRestaurant = await Restaurant.findOne(filter).select({ placeId: 1, partnerDetails: 1 }).lean();
    if (!savedRestaurant) {
      return res.status(404).json({ message: "Restaurant not found in the saved collection." });
    }

    const place = await getGooglePlace(savedRestaurant.placeId);
    return res.status(200).json({ attribution: "Google Maps", place, partnerDetails: savedRestaurant.partnerDetails ?? {} });
  } catch (error) {
    return handlePlacesError(res, error, "Failed to load restaurant:");
  }
});

/** @swagger
 * /api/restaurants:
 *   get:
 *     summary: List saved restaurant Place IDs with live Google Places details.
 *     tags: [restaurant]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 10, default: 2 }
 *     responses:
 *       200: { description: Live restaurant details. Display Google Maps attribution to users. }
 *       502: { description: Google Places request failed. }
 */
router.get("/api/restaurants", async (req, res) => {
  const limit = Number(req.query.limit ?? 2);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    return res.status(400).json({ message: "limit must be an integer from 1 to 10." });
  }

  try {
    const savedRestaurants = await Restaurant.find()
      .sort({ createdAt: 1 })
      .limit(limit)
      .select({ placeId: 1 })
      .lean();
    const places = await Promise.all(
      savedRestaurants.map(({ placeId }) => getGooglePlace(placeId)),
    );

    return res.status(200).json({
      count: places.length,
      attribution: "Google Maps",
      places,
    });
  } catch (error) {
    return handlePlacesError(res, error, "Failed to load saved restaurants:");
  }
});

/** @swagger
 * /api/restaurants/import:
 *   post:
 *     summary: Search Google Places for restaurants and save their Place IDs.
 *     description: Search results are cached in MongoDB for seven days.
 *     tags: [restaurant]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query: { type: string, example: "restaurants in Erie, PA" }
 *               limit: { type: integer, minimum: 1, maximum: 10, default: 2 }
 *     responses:
 *       200: { description: Search results and persisted Place IDs. }
 *       400: { description: Invalid query or limit. }
 *       502: { description: Google Places request failed. }
 */
router.post("/api/restaurants/import", async (req, res) => {
  if (req.body !== undefined && (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).some(key => !["query", "limit"].includes(key)))) {
    return res.status(400).json({ message: "Provide query and limit only." });
  }
  if (req.body?.query !== undefined && typeof req.body.query !== "string") return res.status(400).json({ message: "query must be a string." });
  if (req.body?.limit !== undefined && typeof req.body.limit !== "number") return res.status(400).json({ message: "limit must be a number." });
  const query = (req.body?.query ?? "restaurants in Erie, PA").trim();
  const limit = req.body?.limit ?? 2;

  if (!query || query.length > 200) {
    return res.status(400).json({ message: "query must be between 1 and 200 characters." });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    return res.status(400).json({ message: "limit must be an integer from 1 to 10." });
  }

  try {
    const places = (await searchRestaurants(query, limit)).slice(0, limit);
    if (places.length > 0) {
      await Restaurant.bulkWrite(
        places.map(({ id }) => ({
          updateOne: {
            filter: { placeId: id },
            update: { $setOnInsert: { placeId: id } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    return res.status(200).json({
      query,
      imported: places.length,
      attribution: "Google Maps",
      persistence: "Search results are cached for seven days.",
      places,
    });
  } catch (error) {
    return handlePlacesError(res, error, "Failed to save Google Place IDs:");
  }
});

/** @swagger
 * /api/restaurants/{id}:
 *   delete:
 *     summary: Remove a saved restaurant reference by MongoDB ID or Google Place ID.
 *     description: Requires an assigned approved partner or admin. Removes the shared saved Place ID, not the listing on Google Maps.
 *     security: [{ lobbySession: [] }]
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Restaurant deleted successfully. }
 *       404: { description: Restaurant not found. }
 */
router.delete("/api/restaurants/:id", async (req, res) => {
  const owned = await requireManagedRestaurant(req);
  const restaurantId = String(req.params.id);
  const restaurant = await Restaurant.findOneAndDelete({ _id: owned._id });
  if (!restaurant) return res.status(404).json({ message: "Restaurant not found in the saved collection." });

  return res.status(200).json({
    message: "Restaurant deleted",
    restaurantId: restaurantId,
  });
});

export default router;
