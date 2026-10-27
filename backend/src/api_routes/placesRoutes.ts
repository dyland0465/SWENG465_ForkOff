/**
 * placesRoutes.ts
 *
 * Live lookups from the Google Places API (New):
 *  - GET /api/places/:id          place details
 *  - GET /api/places/:id/reviews  place reviews
 */
import { Router } from "express";
import { getGooglePlace, getGooglePlaceReviews } from "../services/googlePlaces";
import { handlePlacesError } from "../utils/errors";

const router = Router();

/** @swagger
 * /api/places/{id}:
 *   get:
 *     summary: Get restaurant information from Google Places.
 *     tags: [places]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Place information returned successfully. }
 *       404: { description: Place not found. }
 *       502: { description: Google Places request failed. }
 */
router.get("/api/places/:id", async (req, res) => {
  try {
    const place = await getGooglePlace(req.params.id);
    return res.status(200).json({ attribution: "Google Maps", place });
  } catch (error) {
    return handlePlacesError(res, error, "Failed to load Google Place:");
  }
});

/** @swagger
 * /api/places/{id}/reviews:
 *   get:
 *     summary: Get restaurant reviews from Google Places.
 *     description: Returns live Google review objects including authorAttribution. Display Google Maps and review author attribution.
 *     tags: [places]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Place reviews returned successfully. }
 */
router.get("/api/places/:id/reviews", async (req, res) => {
  const placeId = req.params.id;

  try {
    const reviews = await getGooglePlaceReviews(placeId);
    return res.status(200).json({ placeId, attribution: "Google Maps", reviews });
  } catch (error) {
    return handlePlacesError(res, error, "Failed to load Google Place reviews:");
  }
});

export default router;
