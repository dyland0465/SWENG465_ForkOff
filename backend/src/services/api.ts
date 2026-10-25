import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user";
import { Restaurant } from "../models/restaurant";
import { hashPassword, validatePassword } from "./auth";
import { getGooglePlace, getGooglePlaceReviews, GooglePlacesError, searchRestaurants } from "./googlePlaces";
import { establishSession, revokeUserSessions } from "./session";
import { HttpError } from "./lobbyState";


const router = Router();
function requireOwnProfile(req: Request) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new HttpError(400, "Invalid user ID.");
  if (!req.identity?.userId) throw new HttpError(401, "Login is required.");
  if (req.identity.userId !== String(req.params.id).toLowerCase()) throw new HttpError(403, "You can only access your own account.");
}
function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000,
  );
}

function handlePlacesError(res: Response, error: unknown, context: string) {
  if (error instanceof GooglePlacesError) {
    console.error(`${context} Google Places responded ${error.statusCode}: ${error.message}`);
    const status = error.statusCode === 503 ? 503 : error.statusCode === 404 ? 404 : 502;
    const message =
      status === 503
        ? "Google Places is not configured."
        : status === 404
          ? "Google Place not found."
          : "Google Places request failed.";
    return res.status(status).json({ message, providerStatus: error.statusCode });
  }

  console.error(context, error);
  return res.status(500).json({ message: "Failed to process restaurant request." });
}

/*
Resource Types:
Auth - user authentication
User - account related actions
Restaurants - Partner restaurant configuration
Places - Place IDs stored locally; details are fetched live from Google Places
Lobby - Endpoints to run the lobby/game
Group Chat - Endpoints to run group chat
Google Places - Google Places API (New)
 */

/** @swagger
 * /api/health/:
 *   get:
 *     summary: Check API and database health.
 *     tags: [health]
 *     responses:
 *       200: { description: API and MongoDB are healthy. }
 *       503: { description: MongoDB is unavailable. }
 */
router.get("/api/health/", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  return res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected",
  });
});


// Authorize user login.
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authorize a user login.
 *     tags:
 *       - auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "Billy"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "billy@example.com"
 *               password:
 *                 type: string
 *                 example: "Password"
 *     responses:
 *       200:
 *         description: User logged in successfully.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Invalid username/email or password.
 */
router.post("/api/auth/login", async (req, res) => {
  const identifier = String(
    req.body.username ??
      req.body.Username ??
      req.body.email ??
      req.body.Email ??
      "",
  ).trim();
  const password = String(req.body.password ?? req.body.Password ?? "");

  if (!identifier || !password) {
    return res.status(400).json({
      message: "Username or email and password are required.",
    });
  }

  const user = await User.findOne({
    $or: [
      { username: identifier },
      { email: identifier.toLowerCase() },
    ],
  });

  if (!user || !(await validatePassword(password, user.password))) {
    return res.status(401).json({
      message: "Invalid username/email or password.",
    });
  }

  await establishSession(req, res, { id: String(user._id), username: user.username, email: user.email });
  return res.status(200).json({
    message: "User authorized to login.",
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role ?? "user",
      partnerStatus: user.partnerStatus ?? null,
    },
  });
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a user.
 *     tags:
 *       - user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Username
 *               - Password
 *               - Email
 *             properties:
 *               Username:
 *                 type: string
 *                 example: "Billy"
 *               Password:
 *                 type: string
 *                 example: "Password"
 *               Email:
 *                 type: string
 *                 example: "example@example.com"
 *     responses:
 *       201:
 *         description: User created successfully.
 *       400:
 *         description: Invalid input.
 */
router.post("/api/users", async (req, res) => {
  console.log("User creation request received");

  let user = {
    username: req.body.username,
    password: req.body.password,
    email: req.body.email,
  };

  if (!user.username || !user.password || !user.email) {
    return res.status(400).json({
      message: "Username, password, and email are required.",
    });
  }

  try {
    const createdUser = await User.create({
      username: user.username,
      email: user.email,
      password: await hashPassword(user.password),
    });

    await establishSession(req, res, { id: String(createdUser._id), username: createdUser.username, email: createdUser.email });
    return res.status(201).json({
      message: "User created",
      user: {
        id: createdUser._id,
        username: createdUser.username,
        email: createdUser.email,
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return res.status(409).json({
        message: "A user with that email already exists.",
      });
    }

    console.error("Failed to create user:", error);
    return res.status(500).json({ message: "Failed to create user." });
  }
});
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
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get the logged-in user's own profile by ID.
 *     security: [{ lobbySession: [] }]
 *     tags:
 *       - user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "55"
 *     responses:
 *       200:
 *         description: User information returned successfully.
 *       400:
 *         description: Invalid user ID.
 *       404:
 *         description: User not found.
 */
router.get("/api/users/:id", async (req, res) => {
  requireOwnProfile(req);
  const userId = req.params.id;

  const user = await User.findById(userId).select("username email").lean();

  if (user) {
    return res.status(200).json({ id: user._id, username: user.username, email: user.email });
  }

  return res.status(404).json({
    message: "Failed to fetch user. Invalid id?",
  });
});

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Update the logged-in user's own username or email.
 *     security: [{ lobbySession: [] }]
 *     tags:
 *       - user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "55"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "Billy"
 *               email:
 *                 type: string
 *                 example: "example@example.com"
 *     responses:
 *       200:
 *         description: User updated successfully.
 *       400:
 *         description: Invalid input or user ID.
 *       404:
 *         description: User not found.
 */
router.patch("/api/users/:id", async (req, res) => {
  requireOwnProfile(req);
  const userId = req.params.id;

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !Object.keys(body).length || Object.keys(body).some(key => !["username", "email"].includes(key))) {
    return res.status(400).json({ message: "Provide username and/or email only. Password changes are not supported here." });
  }
  const updates: { username?: string; email?: string } = {};
  if (body.username !== undefined) {
    if (typeof body.username !== "string" || !body.username.trim() || body.username.trim().length > 100) {
      return res.status(400).json({ message: "username must be between 1 and 100 characters." });
    }
    updates.username = body.username.trim();
  }
  if (body.email !== undefined) {
    if (typeof body.email !== "string" || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return res.status(400).json({ message: "A valid email is required." });
    }
    updates.email = body.email.trim().toLowerCase();
  }
  try {
    const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).select("username email").lean();
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.status(200).json({ message: "User updated", user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    if (isDuplicateKeyError(error)) return res.status(409).json({ message: "A user with that email already exists." });
    throw error;
  }
});

/** @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete the logged-in user's own account and revoke all sessions.
 *     security: [{ lobbySession: [] }]
 *     tags: [user]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: User deleted successfully. }
 *       404: { description: User not found. }
 */
router.delete("/api/users/:id", async (req, res) => {
  requireOwnProfile(req);
  const userId = req.params.id;

  const user = await User.findByIdAndDelete(userId);
  if (!user) return res.status(404).json({ message: "User not found." });
  await revokeUserSessions(String(user._id));
  res.clearCookie("forkoff_session", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });

  return res.status(200).json({
    message: "User deleted",
    userId: userId,
  });
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
 *     description: Only Place IDs are stored in MongoDB. Full restaurant details are returned from live Places requests.
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
      persistence: "Only Google Place IDs are stored; details are fetched live.",
      places,
    });
  } catch (error) {
    return handlePlacesError(res, error, "Failed to save Google Place IDs:");
  }
});

/** @swagger
 * /api/restaurants/{id}:
 *   patch:
 *     summary: Update restaurant information.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { restaurantName: { type: string }, address: { type: string }, phone: { type: string }, website: { type: string, format: uri }, categories: { type: array, items: { type: string } } } } } }
 *     responses:
 *       200: { description: Restaurant updated successfully. }
 *       400: { description: Invalid restaurant data. }
 */
// TODO: Connect to db to actually edit restaurant info.
router.patch("/api/restaurants/:id", (req, res) => {
  const restaurantId = req.params.id;

  let updates = {
    restaurantName: req.body.restaurantName,
    address: req.body.address,
    phone: req.body.phone,
    website: req.body.website,
    categories: req.body.categories,
  };

  // TODO: Update restaurant in database

  return res.status(200).json({
    message: "Restaurant updated",
    restaurantId: restaurantId,
    updates: updates,
  });
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

/** @swagger
 * /api/restaurants/{id}/menu:
 *   get:
 *     summary: Get a restaurant menu.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Restaurant menu returned successfully. }
 */
// TODO: Fetch menu from database.
router.get("/api/restaurants/:id/menu", (req, res) => {
  const restaurantId = req.params.id;

  const menu = {
    restaurantId: restaurantId,
    categories: [
      {
        name: "Appetizers",
        items: [
          {
            id: 101,
            name: "Crispy Calamari",
            description: "Served with garlic lemon aioli",
            price: 12.5,
          },
          {
            id: 102,
            name: "Truffle Fries",
            description: "Parmesan, parsley, and truffle oil",
            price: 8.0,
          },
        ],
      },
      {
        name: "Main Courses",
        items: [
          {
            id: 201,
            name: "Grilled Ribeye Steak",
            description: "12oz ribeye with rosemary butter and mashed potatoes",
            price: 34.0,
          },
        ],
      },
    ],
  };

  return res.status(200).json(menu);
});

/** @swagger
 * /api/restaurants/{id}/menu:
 *   patch:
 *     summary: Update a restaurant menu.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [menu], properties: { menu: { type: object } } } } }
 *     responses:
 *       200: { description: Restaurant menu updated successfully. }
 *       400: { description: Menu data is required. }
 */
// TODO: Save updates to database.
router.patch("/api/restaurants/:id/menu", (req, res) => {
  const restaurantId = req.params.id;
  const menu = req.body.menu;

  if (!menu) {
    return res.status(400).json({
      message: "Menu data is required.",
    });
  }

  return res.status(200).json({
    message: "Restaurant menu updated",
    restaurantId: restaurantId,
    menu: menu,
  });
});

/** @swagger
 * /api/restaurants/{id}/analytics:
 *   get:
 *     summary: Get restaurant analytics.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Analytics returned successfully. }
 */
// TODO: Generate analytics from database votes/views/swipes.
router.get("/api/restaurants/:id/analytics", (req, res) => {
  const restaurantId = req.params.id;

  const analytics = {
    restaurantId: restaurantId,
    views: 125,
    likes: 80,
    dislikes: 30,
    matches: 45,
    selectionRate: 0.36,
  };

  return res.status(200).json(analytics);
});

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
 * /api/places/{id}/photos:
 *   get:
 *     summary: Get restaurant photos from Google Places.
 *     tags: [places]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Place photos returned successfully. }
 */
// TODO: Fetch photos from Google Places API.
router.get("/api/places/:id/photos", (req, res) => {
  const placeId = req.params.id;

  const photos = [
    {
      id: 1,
      url: "https://example.com/photo1.jpg",
    },
    {
      id: 2,
      url: "https://example.com/photo2.jpg",
    },
  ];

  return res.status(200).json({
    placeId: placeId,
    photos: photos,
  });
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

/** @swagger
 * /api/lobbies/{id}/votes:
 *   post:
 *     summary: Submit a restaurant vote or swipe.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [userId, restaurantId, vote], properties: { userId: { type: string }, restaurantId: { type: string }, vote: { type: string, enum: [like, dislike, veto] } } } } }
 *     responses:
 *       201: { description: Vote submitted successfully. }
 *       400: { description: Invalid vote request. }
 */
router.post("/api/lobbies/:id/votes", (req, res) => {
  const lobbyId = req.params.id;

  const vote = {
    userId: req.body.userId,
    restaurantId: req.body.restaurantId,
    vote: req.body.vote,
  };

  if (
    !vote.userId ||
    !vote.restaurantId ||
    !["like", "dislike", "veto"].includes(vote.vote)
  ) {
    return res.status(400).json({
      message: "Invalid vote request.",
    });
  }

  return res.status(201).json({
    message: "Vote submitted",
    lobbyId: lobbyId,
    vote: vote,
  });
});

/** @swagger
 * /api/lobbies/{id}/results:
 *   get:
 *     summary: Get game results.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Game results returned successfully. }
 */
router.get("/api/lobbies/:id/results", (req, res) => {
  const lobbyId = req.params.id;

  const results = [
    {
      restaurantId: 1,
      restaurantName: "Applebee's",
      votes: 4,
      totalMembers: 5,
    },
    {
      restaurantId: 2,
      restaurantName: "Taco Bell",
      votes: 3,
      totalMembers: 5,
    },
  ];

  return res.status(200).json({
    lobbyId: lobbyId,
    results: results,
  });
});

/** @swagger
 * /api/groupchats:
 *   post:
 *     summary: Create a group chat.
 *     tags: [group-chat]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [creatorId], properties: { name: { type: string }, creatorId: { type: string } } } } }
 *     responses:
 *       201: { description: Group chat created successfully. }
 *       400: { description: Creator ID is required. }
 */
router.post("/api/groupchats", (req, res) => {
  const groupchat = {
    id: "CHAT123",
    name: req.body.name,
    creatorId: req.body.creatorId,
  };

  if (!groupchat.creatorId) {
    return res.status(400).json({
      message: "Creator ID is required.",
    });
  }

  return res.status(201).json({
    message: "Group chat created",
    groupchat: groupchat,
  });
});

/** @swagger
 * /api/groupchats/{id}/members:
 *   get:
 *     summary: Get group chat members.
 *     tags: [group-chat]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Group chat members returned successfully. }
 */
router.get("/api/groupchats/:id/members", (req, res) => {
  const groupchatId = req.params.id;

  const members = [
    {
      id: 1,
      username: "UserOne",
    },
    {
      id: 2,
      username: "UserTwo",
    },
  ];

  return res.status(200).json({
    groupchatId: groupchatId,
    members: members,
  });
});

/** @swagger
 * /api/groupchats/{id}/messages:
 *   get:
 *     summary: Get group chat messages.
 *     tags: [group-chat]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Group chat messages returned successfully. }
 */
router.get("/api/groupchats/:id/messages", (req, res) => {
  const groupchatId = req.params.id;

  const messages = [
    {
      id: 1,
      senderId: 1,
      message: "Where should we eat?",
      sentAt: new Date(),
    },
    {
      id: 2,
      senderId: 2,
      message: "I'm good with anything.",
      sentAt: new Date(),
    },
  ];

  return res.status(200).json({
    groupchatId: groupchatId,
    messages: messages,
  });
});

/** @swagger
 * /api/groupchats/{id}:
 *   patch:
 *     summary: Update a group chat.
 *     tags: [group-chat]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { name: { type: string } } } } }
 *     responses:
 *       200: { description: Group chat updated successfully. }
 */
router.patch("/api/groupchats/:id", (req, res) => {
  const groupchatId = req.params.id;

  const updates = {
    name: req.body.name,
  };

  return res.status(200).json({
    message: "Group chat updated",
    groupchatId: groupchatId,
    updates: updates,
  });
});

/** @swagger
 * /api/groupchats/{id}:
 *   delete:
 *     summary: Delete a group chat.
 *     tags: [group-chat]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Group chat deleted successfully. }
 *       404: { description: Group chat not found. }
 */
router.delete("/api/groupchats/:id", (req, res) => {
  const groupchatId = req.params.id;

  return res.status(200).json({
    message: "Group chat deleted",
    groupchatId: groupchatId,
  });
});

export default router;
