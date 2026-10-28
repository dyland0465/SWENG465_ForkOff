/**
 * partnerRoutes.ts
 *
 * POST /api/partners/register — restaurant partner sign-up. Creates the account
 * with role "partner" and status "pending" until an admin approves it
 * (see adminRoutes.ts).
 */
import { Router } from "express";
import { User } from "../db_models/user";
import { hashPassword } from "../services/passwordHashing";
import { establishSession } from "../services/session";
import { isDuplicateKeyError } from "../utils/errors";

const router = Router();

/**
 * Partner accounts: create a restaurant partner account.
 *
 * Works like POST /api/users, but the account is saved with role "partner" and
 * partnerStatus "pending", along with the restaurant they say they own. They are
 * logged in right away (same session cookie as regular users), but they get no
 * restaurant access until an admin approves them and fills in restaurantIds.
 * The role is always set here on the server, never taken from the request body,
 * so nobody can make themselves an admin or an approved partner.
 *
 * @swagger
 * /api/partners/register:
 *   post:
 *     summary: Create a restaurant partner account (pending approval).
 *     tags: [user]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password, restaurantName, restaurantAddress]
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               restaurantName: { type: string }
 *               restaurantAddress: { type: string }
 *     responses:
 *       201: { description: Partner account created and waiting for approval. }
 *       400: { description: Invalid input. }
 *       409: { description: A user with that email already exists. }
 */
router.post("/api/partners/register", async (req, res) => {
  // Only accept plain strings, trimmed and length-capped.
  const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const username = text(req.body?.username, 30);
  const email = text(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const restaurantName = text(req.body?.restaurantName, 120);
  const restaurantAddress = text(req.body?.restaurantAddress, 200);

  if (!username || !email || !password || !restaurantName || !restaurantAddress) {
    return res.status(400).json({ message: "Username, email, password, restaurant name, and restaurant address are required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  try {
    const partner = await User.create({
      username,
      email,
      password: await hashPassword(password),
      role: "partner",
      partnerStatus: "pending",
      restaurantIds: [],
      requestedRestaurant: { name: restaurantName, address: restaurantAddress },
    });

    await establishSession(req, res, { id: String(partner._id), username: partner.username, email: partner.email });
    return res.status(201).json({
      message: "Partner account created. It is waiting for approval.",
      user: {
        id: partner._id,
        username: partner.username,
        email: partner.email,
        role: "partner",
        partnerStatus: "pending",
      },
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({ message: "A user with that email already exists." });
    }
    console.error("Failed to create partner:", error);
    return res.status(500).json({ message: "Failed to create partner account." });
  }
});

export default router;
