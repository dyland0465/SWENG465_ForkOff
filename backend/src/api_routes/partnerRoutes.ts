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
import { registrationFields } from "../utils/registration";
import { isDuplicateKeyError } from "../utils/errors";
import { partnerRestaurantFields } from "../utils/partnerApplication";

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
 *        *required: [username, email, password, restaurantName, restaurantAddress, city, state, postalCode, restaurantPhone, cuisine, priceLevel, businessType, serviceOptions, applicantRole, agreedToTerms]
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               restaurantName: { type: string, maxLength: 120 }
 *               restaurantAddress: { type: string, maxLength: 200, description: Street address }
 *               city: { type: string, maxLength: 80 }
 *               state: { type: string, pattern: "^[A-Za-z]{2}$", example: PA }
 *               postalCode: { type: string, pattern: "^\\d{5}(-\\d{4})?$", example: "16801" }
 *               restaurantPhone: { type: string, description: At least 10 digits }
 *               website: { type: string, format: uri }
 *               cuisine: { type: string, enum: [Italian, Ramen, Mexican, American, Asian, Fast food, Vegetarian, Other] }
 *               priceLevel: { type: string, enum: [$, $$, $$$] }
 *               businessType: { type: string, enum: [Independent restaurant, Franchise or chain location, Food truck, Ghost kitchen, Other] }
 *               serviceOptions: { type: array, minItems: 1, items: { type: string, enum: [Dine-in, Takeout, Delivery] } }
 *               applicantRole: { type: string, enum: [Owner, General manager, Marketing or staff, Other] }
 *               notes: { type: string, maxLength: 500 }
 *               agreedToTerms: { type: boolean, enum: [true] }
 *     responses:
 *       201: { description: Partner account created and waiting for approval. }
 *       400: { description: Invalid input. }
 *       409: { description: A user with that email already exists. }
 */
router.post("/api/partners/register", async (req, res) => {
  // Only accept plain strings, trimmed and length-capped.
  const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max ? value.trim() : "";
    const user = registrationFields(req.body);
  const restaurant = partnerRestaurantFields(req.body);
  if (!user || !restaurant) {
    return res.status(400).json({ message: "Provide valid account and restaurant details; password must be 8 to 128 characters." });
  }
  if (req.body?.agreedToTerms !== true) {
    return res.status(400).json({ message: "Confirm that you are authorized to represent this restaurant." });
  }
  const { username, email, password } = user;

  try {
    const partner = await User.create({
      username,
      email,
      password: await hashPassword(password),
      role: "partner",
      partnerStatus: "pending",
      restaurantIds: [],
            requestedRestaurant: restaurant,
      partnerAgreedAt: new Date(),
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
