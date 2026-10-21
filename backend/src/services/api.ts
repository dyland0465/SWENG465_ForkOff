import { Router, type Response } from "express";
import mongoose from "mongoose";
import { randomInt, randomUUID } from "node:crypto";
import { User } from "../models/user";
import { Lobby } from "../models/lobby";
import { Restaurant } from "../models/restaurant";
import { hashPassword, validatePassword } from "./auth";
import { getGooglePlace, GooglePlacesError, searchRestaurants } from "./googlePlaces";
import { GroupchatMessage } from "../models/groupchat";


const router = Router();
const lobbyCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateLobbyCode() {
  return Array.from({ length: 6 }, () => lobbyCodeAlphabet[randomInt(lobbyCodeAlphabet.length)]).join("");
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

  return res.status(200).json({
    message: "User authorized to login.",
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
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
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a user's information by ID.
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
router.get("/api/users/:id", (req, res) => {
  const userId = req.params.id;

  // TODO: Query user from database using userId
  let user = {
    id: userId,
    username: "User",
    email: "Example@example.com",
  };

  if (user) {
    return res.status(200).json(user);
  }

  return res.status(404).json({
    message: "Failed to fetch user. Invalid id?",
  });
});

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Edit a user's information by ID.
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
 *               password:
 *                 type: string
 *                 example: "Password"
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
router.patch("/api/users/:id", (req, res) => {
  const userId = req.params.id;

  let updates = {
    username: req.body.username,
    password: req.body.password,
    email: req.body.email,
  };

  // TODO:
  // Find user by userId
  // Validate provided fields
  // Hash password if password changes
  // Apply updates

  return res.status(200).json({
    message: "User updated",
    userId: userId,
    updates: updates,
  });
});

/** @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user by ID.
 *     tags: [user]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: User deleted successfully. }
 *       404: { description: User not found. }
 */
// TODO: Implement connection to db to delete user
router.delete("/api/users/:id", (req, res) => {
  const userId = req.params.id;

  // TODO: Delete user from database

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
 *     summary: Delete custom restaurant information.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Restaurant deleted successfully. }
 *       404: { description: Restaurant not found. }
 */
// TODO: Connect to db.
router.delete("/api/restaurants/:id", (req, res) => {
  const restaurantId = req.params.id;

  // TODO: Delete custom restaurant info from database

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
 *     tags: [places]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Place reviews returned successfully. }
 */
// TODO: Fetch reviews from Google Places API.
router.get("/api/places/:id/reviews", (req, res) => {
  const placeId = req.params.id;

  const reviews = [
    {
      author: "Test User",
      rating: 5,
      text: "Great restaurant.",
    },
    {
      author: "Example User",
      rating: 4,
      text: "Good food.",
    },
  ];

  return res.status(200).json({
    placeId: placeId,
    reviews: reviews,
  });
});

/** @swagger
 * /api/lobbies:
 *   post:
 *     summary: Create and persist a lobby.
 *     tags: [lobby]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [location, dinnerAt]
 *             properties:
 *               name: { type: string, maxLength: 120, example: "Dinner in Erie, PA" }
 *               hostId: { type: string, description: Optional MongoDB user ID for an authenticated host. }
 *               location: { type: string, maxLength: 120, example: "Erie, PA" }
 *               dinnerAt: { type: string, format: date-time, example: "2026-10-20T23:30:00.000Z" }
 *               maxDistance: { type: number, minimum: 1, maximum: 100, example: 5 }
 *               minimumRating: { type: number, minimum: 0, maximum: 5, example: 4 }
 *               categories: { type: array, items: { type: string }, example: ["Italian", "Ramen"] }
 *               priceLevels: { type: array, items: { type: string, enum: ["$", "$$", "$$$"] }, example: ["$$"] }
 *               diningNeeds: { type: array, items: { type: string }, example: ["Open at dining time", "Mocktails"] }
 *     responses:
 *       201: { description: Lobby persisted to the main.lobbies collection. }
 *       400: { description: Invalid lobby metadata. }
 *       404: { description: Specified host user not found. }
 */
router.post("/api/lobbies", async (req, res) => {
  const body = req.body ?? {};
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const dinnerAt = typeof body.dinnerAt === "string" ? new Date(body.dinnerAt) : null;
  const maxDistance = Number(body.maxDistance ?? 5);
  const minimumRating = Number(body.minimumRating ?? 0);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const categories = body.categories ?? [];
  const priceLevels = body.priceLevels ?? [];
  const diningNeeds = body.diningNeeds ?? [];

  if (!location || location.length > 120) {
    return res.status(400).json({ message: "Location is required and must be 120 characters or fewer." });
  }
  if (!dinnerAt || !Number.isFinite(dinnerAt.getTime()) || dinnerAt.getTime() <= Date.now()) {
    return res.status(400).json({ message: "Choose a valid dinner date and time in the future." });
  }
  if (!Number.isFinite(maxDistance) || maxDistance < 1 || maxDistance > 100) {
    return res.status(400).json({ message: "maxDistance must be between 1 and 100 miles." });
  }
  if (!Number.isFinite(minimumRating) || minimumRating < 0 || minimumRating > 5) {
    return res.status(400).json({ message: "minimumRating must be between 0 and 5." });
  }
  if (name.length > 120) {
    return res.status(400).json({ message: "name must be 120 characters or fewer." });
  }
  if (
    !Array.isArray(categories) ||
    categories.length > 20 ||
    categories.some((value: unknown) => typeof value !== "string" || value.length > 40)
  ) {
    return res.status(400).json({ message: "categories must be an array of up to 20 short strings." });
  }
  if (
    !Array.isArray(priceLevels) ||
    priceLevels.some((value: unknown) => !["$", "$$", "$$$"].includes(String(value)))
  ) {
    return res.status(400).json({ message: "priceLevels may only contain $, $$, or $$$." });
  }
  if (
    !Array.isArray(diningNeeds) ||
    diningNeeds.length > 10 ||
    diningNeeds.some((value: unknown) => typeof value !== "string" || value.length > 60)
  ) {
    return res.status(400).json({ message: "diningNeeds must be an array of up to 10 short strings." });
  }

  const rawHostId = body.hostId ?? body.hostID;

  try {
    let hostId: mongoose.Types.ObjectId | undefined;
    if (rawHostId !== undefined && rawHostId !== null && rawHostId !== "") {
      if (typeof rawHostId !== "string" || !mongoose.isValidObjectId(rawHostId)) {
        return res.status(400).json({ message: "hostId must be a valid MongoDB user ID." });
      }

      const host = await User.findById(rawHostId).select("_id");
      if (!host) {
        return res.status(404).json({ message: "Host user not found." });
      }
      hostId = host._id;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const createdLobby = await Lobby.create({
          lobbyCode: generateLobbyCode(),
          name: name || `Dinner in ${location}`,
          ...(hostId ? { hostID: hostId, members: [hostId] } : { members: [] }),
          status: "waiting",
          filters: {
            location,
            dinnerAt,
            maxDistance,
            minimumRating,
            categories,
            openNow: diningNeeds.includes("Open at dining time"),
            priceLevels,
            diningNeeds,
          },
        });

        return res.status(201).json({
          message: "Lobby created and saved.",
          lobby: {
            id: createdLobby._id,
            lobbyCode: createdLobby.lobbyCode,
            name: createdLobby.name,
            hostId: createdLobby.hostID ?? null,
            status: createdLobby.status,
            filters: createdLobby.filters,
            createdAt: createdLobby.createdAt,
            updatedAt: createdLobby.updatedAt,
          },
        });
      } catch (error) {
        if (isDuplicateKeyError(error) && attempt < 4) continue;
        throw error;
      }
    }

    return res.status(503).json({ message: "Could not generate a unique lobby code. Please try again." });
  } catch (error) {
    console.error("Failed to create lobby:", error);
    return res.status(500).json({ message: "Failed to create lobby." });
  }
});

/** @swagger
 * /api/lobbies/{id}:
 *   get:
 *     summary: Get lobby information.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Lobby returned successfully. }
 *       404: { description: Lobby not found. }
 */
router.get("/api/lobbies/:id", async (req, res) => {
  const key = req.params.id.trim();
  try {
    const lobby = await Lobby.findOne(
      mongoose.isValidObjectId(key) ? { _id: key } : { lobbyCode: key.toUpperCase() },
    ).populate("members", "username");
    if (!lobby) return res.status(404).json({ message: "Lobby not found." });
    return res.status(200).json({
      id: lobby._id,
      name: lobby.name,
      lobbyCode: lobby.lobbyCode,
      status: lobby.status,
      filters: lobby.filters,
      members: lobby.members,
      guestMembers: lobby.guestMembers,
    });
  } catch (error) {
    console.error("Failed to fetch lobby:", error);
    return res.status(500).json({ message: "Failed to fetch lobby." });
  }
});

/** @swagger
 * /api/lobbies/{id}:
 *   patch:
 *     summary: Update lobby settings.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { name: { type: string }, status: { type: string } } } } }
 *     responses:
 *       200: { description: Lobby updated successfully. }
 */
router.patch("/api/lobbies/:id", (req, res) => {
  const lobbyId = req.params.id;

  const updates = {
    name: req.body.name,
    status: req.body.status,
  };

  return res.status(200).json({
    message: "Lobby updated",
    lobbyId: lobbyId,
    updates: updates,
  });
});

/** @swagger
 * /api/lobbies/{id}:
 *   delete:
 *     summary: Delete a lobby.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Lobby deleted successfully. }
 *       404: { description: Lobby not found. }
 */
router.delete("/api/lobbies/:id", (req, res) => {
  const lobbyId = req.params.id;

  return res.status(200).json({
    message: "Lobby deleted",
    lobbyId: lobbyId,
  });
});

/** @swagger
 * /api/lobbies/{id}/join:
 *   post:
 *     summary: Join a lobby as a registered user or guest.
 *     tags: [lobby]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Lobby MongoDB ID or six-character invite code.
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string, description: Existing registered user's MongoDB ID. }
 *               displayName: { type: string, minLength: 2, maxLength: 40, description: Guest display name; no account required. }
 *     responses:
 *       200: { description: Registered user joined successfully. }
 *       201: { description: Guest joined successfully. }
 *       400: { description: Provide either userId or a valid guest displayName. }
 *       404: { description: Lobby or user not found. }
 *       409: { description: Lobby is not accepting new members. }
 */
router.post("/api/lobbies/:id/join", async (req, res) => {
  const lobbyKey = req.params.id.trim();
  const body = req.body ?? {};
  const hasUserId = typeof body.userId === "string" && body.userId.trim().length > 0;
  const rawDisplayName = body.displayName ?? body.guestName;
  const displayName = typeof rawDisplayName === "string" ? rawDisplayName.trim() : "";

  if (hasUserId === Boolean(displayName)) {
    return res.status(400).json({ message: "Provide either userId or a guest displayName, but not both." });
  }
  if (displayName && (displayName.length < 2 || displayName.length > 40)) {
    return res.status(400).json({ message: "Guest displayName must be between 2 and 40 characters." });
  }
  if (hasUserId && !mongoose.isValidObjectId(body.userId.trim())) {
    return res.status(400).json({ message: "userId must be a valid MongoDB user ID." });
  }

  try {
    const lobby = mongoose.isValidObjectId(lobbyKey)
      ? await Lobby.findById(lobbyKey)
      : await Lobby.findOne({ lobbyCode: lobbyKey.toUpperCase() });

    if (!lobby) {
      return res.status(404).json({ message: "Lobby not found. Check the invitation code." });
    }
    if (lobby.status !== "waiting") {
      return res.status(409).json({ message: "This lobby is no longer accepting members." });
    }

    if (hasUserId) {
      const user = await User.findById(body.userId.trim()).select("_id username");
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (!lobby.members.some((memberId) => memberId.equals(user._id))) {
        lobby.members.push(user._id);
        await lobby.save();
      }

      return res.status(200).json({
        message: "User joined lobby.",
        lobby: { id: lobby._id, name: lobby.name, lobbyCode: lobby.lobbyCode },
        member: { id: user._id, displayName: user.username, type: "user" },
      });
    }

    const guest = { guestId: randomUUID(), displayName };
    lobby.guestMembers.push(guest);
    await lobby.save();

    return res.status(201).json({
      message: "Guest joined lobby.",
      lobby: { id: lobby._id, name: lobby.name, lobbyCode: lobby.lobbyCode },
      member: { ...guest, type: "guest" },
    });
  } catch (error) {
    console.error("Failed to join lobby:", error);
    return res.status(500).json({ message: "Failed to join lobby." });
  }
});

/** @swagger
 * /api/lobbies/{id}/leave:
 *   post:
 *     summary: Leave a lobby.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [userId], properties: { userId: { type: string } } } } }
 *     responses:
 *       200: { description: User left lobby successfully. }
 *       400: { description: User ID is required. }
 */
router.post("/api/lobbies/:id/leave", (req, res) => {
  const lobbyId = req.params.id;
  const userId = req.body.userId;

  if (!userId) {
    return res.status(400).json({
      message: "User ID is required.",
    });
  }

  return res.status(200).json({
    message: "User left lobby",
    lobbyId: lobbyId,
    userId: userId,
  });
});

/** @swagger
 * /api/lobbies/{id}/members:
 *   get:
 *     summary: Get lobby members.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Lobby members returned successfully. }
 */
router.get("/api/lobbies/:id/members", (req, res) => {
  const lobbyId = req.params.id;

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
    lobbyId: lobbyId,
    members: members,
  });
});

/** @swagger
 * /api/lobbies/{id}/restaurants:
 *   get:
 *     summary: Get restaurants in a lobby.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Lobby restaurants returned successfully. }
 */
router.get("/api/lobbies/:id/restaurants", (req, res) => {
  const lobbyId = req.params.id;

  const restaurants = [
    {
      id: 1,
      name: "Restaurant One",
      rating: 4.4,
    },
    {
      id: 2,
      name: "Restaurant Two",
      rating: 4.7,
    },
  ];

  return res.status(200).json({
    lobbyId: lobbyId,
    restaurants: restaurants,
  });
});

/** @swagger
 * /api/lobbies/{id}/filters:
 *   get:
 *     summary: Get lobby filters.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Lobby filters returned successfully. }
 */
router.get("/api/lobbies/:id/filters", (req, res) => {
  const lobbyId = req.params.id;

  const filters = {
    maxDistance: 10,
    minimumRating: 4,
    maxPriceLevel: 3,
    categories: ["American", "Mexican"],
    openNow: true,
    alcoholAvailable: false,
  };

  return res.status(200).json({
    lobbyId: lobbyId,
    filters: filters,
  });
});

/** @swagger
 * /api/lobbies/{id}/filters:
 *   patch:
 *     summary: Update lobby filters.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { maxDistance: { type: number }, minimumRating: { type: number }, maxPriceLevel: { type: integer }, categories: { type: array, items: { type: string } }, openNow: { type: boolean }, alcoholAvailable: { type: boolean } } } } }
 *     responses:
 *       200: { description: Lobby filters updated successfully. }
 */
router.patch("/api/lobbies/:id/filters", (req, res) => {
  const lobbyId = req.params.id;

  const filters = {
    maxDistance: req.body.maxDistance,
    minimumRating: req.body.minimumRating,
    maxPriceLevel: req.body.maxPriceLevel,
    categories: req.body.categories,
    openNow: req.body.openNow,
    alcoholAvailable: req.body.alcoholAvailable,
  };

  return res.status(200).json({
    message: "Lobby filters updated",
    lobbyId: lobbyId,
    filters: filters,
  });
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

//groupchats
router.post("/api/lobbies/:id/messages", async (req, res) => {
  const text: unknown = req.body.text;

  if (typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ message: "Message text is required." });
  }

  const savedMsg = await GroupchatMessage.create({
    LobbyId: req.params.id,
    userId: req.body.userId,
    message: text.trim(),
  });
  return res.status(201).json(savedMsg);
});





export default router;
