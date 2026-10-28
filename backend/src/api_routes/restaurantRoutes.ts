/**
 * restaurantRoutes.ts
 *
 * Restaurants saved in MongoDB, including a seven-day search cache:
 *  - GET    /api/restaurants         list saved restaurants
 *  - GET    /api/restaurants/:id     one restaurant
 *  - POST   /api/restaurants/import  search Google and save the results
 *  - DELETE /api/restaurants/:id     remove a saved restaurant
 * Unfinished restaurant routes (edit, menu, analytics) are in placeholderRoutes.ts.
 */
import { Router } from "express";
import mongoose from "mongoose";
import { Restaurant } from "../db_models/restaurant";
import { getGooglePlace, searchRestaurants } from "../services/googlePlaces";
import { handlePlacesError } from "../utils/errors";

const router = Router();

router.get('/api/restaurant-photos/:placeId', async (req, res, next) => {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const restaurant = await Restaurant.findOne({ placeId: req.params.placeId, cachedAt: { $gt: cutoff } }).select('+cachedPhoto cachedPhotoType');
    if (!restaurant?.cachedPhoto || !restaurant.cachedPhotoType) return res.status(404).end();
    res.type(restaurant.cachedPhotoType).send(restaurant.cachedPhoto);
  } catch (error) { next(error); }
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
    const savedRestaurant = await Restaurant.findOne(filter).select({ placeId: 1 }).lean();
    if (!savedRestaurant) {
      return res.status(404).json({ message: "Restaurant not found in the saved collection." });
    }

    const place = await getGooglePlace(savedRestaurant.placeId);
    return res.status(200).json({ attribution: "Google Maps", place });
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
  const query = typeof req.body?.query === "string"
    ? req.body.query.trim()
    : "restaurants in Erie, PA";
  const limit = Number(req.body?.limit ?? 2);

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
 *     description: Requires login. Removes the shared saved Place ID, not the listing on Google Maps.
 *     security: [{ lobbySession: [] }]
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Restaurant deleted successfully. }
 *       404: { description: Restaurant not found. }
 */
router.delete("/api/restaurants/:id", async (req, res) => {
  if (!req.identity?.userId) return res.status(401).json({ message: "Login is required." });
  const restaurantId = req.params.id;

  const filter = mongoose.isObjectIdOrHexString(restaurantId)
    ? { $or: [{ placeId: restaurantId }, { _id: new mongoose.Types.ObjectId(restaurantId) }] }
    : { placeId: restaurantId };
  const restaurant = await Restaurant.findOneAndDelete(filter);
  if (!restaurant) return res.status(404).json({ message: "Restaurant not found in the saved collection." });

  return res.status(200).json({
    message: "Restaurant deleted",
    restaurantId: restaurantId,
  });
});

export default router;
