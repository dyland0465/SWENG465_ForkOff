import { Router } from "express";
import { User } from "../modules/user";
import { hashPassword, validatePassword } from "./auth";

const router = Router();

/*
Resource Types:
Auth - user authentication
User - account related actions
Restaurants - Partner restaurant configuration
Places - Our own data stored pulled from Google Places
Lobby - Endpoints to run the lobby/game
Group Chat - Endpoints to run group chat
Google Places - Google Places API, 10,000 requests/month
 */

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
 *     summary: Get restaurant information by ID.
 *     tags: [restaurant]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Restaurant information returned successfully. }
 *       404: { description: Restaurant not found. }
 */
// TODO: Connect to db to actually grab restaurant info.
router.get("/api/restaurants/:id", (req, res) => {
  const restaurantId = req.params.id;

  const info = {
    restaurantId: restaurantId,
    restaurantName: "The Bistro Grill",
    address: "123 Main Street",
    phone: "555-555-5555",
    website: "https://example.com",
    currency: "USD",
    categories: ["American", "Grill"],
  };

  return res.status(200).json(info);
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
 */
// TODO: Connect to Google Places API.
router.get("/api/places/:id", (req, res) => {
  const placeId = req.params.id;

  const place = {
    placeId: placeId,
    displayName: "Example Restaurant",
    address: "123 Main Street",
    rating: 4.5,
    priceLevel: 2,
    openNow: true,
  };

  return res.status(200).json(place);
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
 *     summary: Create a lobby.
 *     tags: [lobby]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [hostId], properties: { name: { type: string }, hostId: { type: string }, maxDistance: { type: number } } } } }
 *     responses:
 *       201: { description: Lobby created successfully. }
 *       400: { description: Host ID is required. }
 */
// TODO: Save lobby to database.
router.post("/api/lobbies", (req, res) => {
  const lobby = {
    id: "ABC123",
    name: req.body.name,
    hostId: req.body.hostId,
    maxDistance: req.body.maxDistance,
    createdAt: new Date(),
  };

  if (!lobby.hostId) {
    return res.status(400).json({
      message: "Host ID is required.",
    });
  }

  return res.status(201).json({
    message: "Lobby created",
    lobby: lobby,
  });
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
router.get("/api/lobbies/:id", (req, res) => {
  const lobbyId = req.params.id;

  const lobby = {
    id: lobbyId,
    name: "Dinner Group",
    hostId: "1",
    memberCount: 3,
    status: "waiting",
  };

  return res.status(200).json(lobby);
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
 *     summary: Join a lobby.
 *     tags: [lobby]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [userId], properties: { userId: { type: string } } } } }
 *     responses:
 *       200: { description: User joined lobby successfully. }
 *       400: { description: User ID is required. }
 */
router.post("/api/lobbies/:id/join", (req, res) => {
  const lobbyId = req.params.id;
  const userId = req.body.userId;

  if (!userId) {
    return res.status(400).json({
      message: "User ID is required.",
    });
  }

  return res.status(200).json({
    message: "User joined lobby",
    lobbyId: lobbyId,
    userId: userId,
  });
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

export default router;
