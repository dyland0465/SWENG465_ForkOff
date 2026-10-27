/**
 * adminApi.ts
 *
 * Admin-only routes for reviewing partner sign-ups. Every route under /api/admin
 * goes through requireRole("admin"), so regular users and partners get a 403.
 *
 *  - GET  /api/admin/partners?status=pending   List partner accounts (pending,
 *                                              approved, rejected, or all).
 *  - GET  /api/admin/places?query=...          Search Google Places for the
 *                                              restaurant a partner claimed, so
 *                                              the admin can pick the right one.
 *  - POST /api/admin/partners/:id/approve      Approve a partner and link them to
 *                                              a restaurant (by Google Place ID).
 *  - POST /api/admin/partners/:id/reject       Reject a partner.
 *
 * Approving saves the restaurant in the "restaurants" collection (if it isn't
 * there already) and adds its _id to the partner's restaurantIds, which is what
 * gives them access to that restaurant's insights.
 */
import { Router } from "express";
import mongoose from "mongoose";
import { User } from "../db models/user";
import { Restaurant } from "../db models/restaurant";
import { requireRole } from "../middleware/requireRole";
import { GooglePlacesError, searchRestaurants } from "../services/googlePlaces";

const router = Router();

// Everything below this line is admins only.
router.use("/api/admin", requireRole("admin"));

const statuses = ["pending", "approved", "rejected"] as const;
const partnerFields = "username email partnerStatus requestedRestaurant restaurantIds createdAt";

// Shape a partner document for the admin screen (never includes the password).
function serializePartner(user: any) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    status: user.partnerStatus ?? "pending",
    requestedRestaurant: { name: user.requestedRestaurant?.name ?? "", address: user.requestedRestaurant?.address ?? "" },
    restaurantIds: (user.restaurantIds ?? []).map(String),
    createdAt: user.createdAt,
  };
}

/**
 * @swagger
 * /api/admin/partners:
 *   get:
 *     summary: List partner accounts (admin only).
 *     tags: [admin]
 *     parameters: [{ in: query, name: status, schema: { type: string, enum: [pending, approved, rejected, all] } }]
 *     responses:
 *       200: { description: Partners returned. }
 *       401: { description: Login is required. }
 *       403: { description: Not an admin. }
 */
router.get("/api/admin/partners", async (req, res) => {
  const status = String(req.query.status ?? "pending");
  if (status !== "all" && !statuses.includes(status as never)) return res.status(400).json({ message: "Invalid status." });
  const filter = status === "all"
    ? { role: "partner" as const }
    : { role: "partner" as const, partnerStatus: status as (typeof statuses)[number] };
  const partners = await User.find(filter).select(partnerFields).sort({ createdAt: 1 }).limit(200).lean();
  return res.json({ partners: partners.map(serializePartner) });
});

/**
 * @swagger
 * /api/admin/places:
 *   get:
 *     summary: Search Google Places for restaurants (admin only).
 *     tags: [admin]
 *     parameters: [{ in: query, name: query, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Matching restaurants. }
 *       503: { description: Google Places is not configured. }
 */
router.get("/api/admin/places", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim().slice(0, 200) : "";
  if (!query) return res.status(400).json({ message: "Enter something to search for." });
  try {
    const places = await searchRestaurants(query, 5);
    return res.json({
      places: places.map(place => ({ placeId: place.id, name: place.displayName?.text ?? "", address: place.formattedAddress ?? "" })),
    });
  } catch (error) {
    const status = error instanceof GooglePlacesError && error.statusCode === 503 ? 503 : 502;
    return res.status(status).json({ message: status === 503 ? "Restaurant search isn't set up on this server. Paste a Google Place ID instead." : "Restaurant search failed. Try again or paste a Google Place ID." });
  }
});

/**
 * @swagger
 * /api/admin/partners/{id}/approve:
 *   post:
 *     summary: Approve a partner and link a restaurant (admin only).
 *     tags: [admin]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [placeId], properties: { placeId: { type: string } } }
 *     responses:
 *       200: { description: Partner approved. }
 *       400: { description: Invalid partner ID or Place ID. }
 *       404: { description: Partner not found. }
 */
router.post("/api/admin/partners/:id/approve", async (req, res) => {
  const id = String(req.params.id);
  const placeId = typeof req.body?.placeId === "string" ? req.body.placeId.trim() : "";
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: "Invalid partner ID." });
  // Google Place IDs are letters, numbers, - and _.
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return res.status(400).json({ message: "Choose a restaurant or enter a valid Google Place ID." });

  // Save the restaurant if it's new (same pattern as /api/restaurants/import).
  const restaurant = await Restaurant.findOneAndUpdate(
    { placeId },
    { $setOnInsert: { placeId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  if (!restaurant) return res.status(500).json({ message: "Could not save the restaurant." });

  const partner = await User.findOneAndUpdate(
    { _id: id, role: "partner" },
    { $set: { partnerStatus: "approved" }, $addToSet: { restaurantIds: restaurant._id } },
    { returnDocument: "after" },
  ).select(partnerFields).lean();
  if (!partner) return res.status(404).json({ message: "Partner not found." });
  return res.json({ partner: serializePartner(partner) });
});

/**
 * @swagger
 * /api/admin/partners/{id}/reject:
 *   post:
 *     summary: Reject a partner (admin only).
 *     tags: [admin]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Partner rejected. }
 *       404: { description: Partner not found. }
 */
router.post("/api/admin/partners/:id/reject", async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: "Invalid partner ID." });
  // Rejecting also removes any restaurant access they had.
  const partner = await User.findOneAndUpdate(
    { _id: id, role: "partner" },
    { $set: { partnerStatus: "rejected", restaurantIds: [] } },
    { returnDocument: "after" },
  ).select(partnerFields).lean();
  if (!partner) return res.status(404).json({ message: "Partner not found." });
  return res.json({ partner: serializePartner(partner) });
});

export default router;