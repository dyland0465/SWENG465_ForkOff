/**
 * placeholderRoutes.ts
 *
 * ⚠️ NOT REAL YET. Every route in this file returns hard-coded demo data and does
 * NOT read or save anything in the database, even when it says "updated" or
 * "submitted". They came from the original API design and are kept here so the
 * Postman collection and Swagger docs keep working while the team decides what
 * to build. Do not call them from the frontend as if they work.
 *
 *  - Restaurant edit, menu and analytics:   /api/restaurants/:id (PATCH), /menu, /analytics
 *  - Place photos:                          /api/places/:id/photos
 *  - Lobby votes and results:               /api/lobbies/:id/votes, /results
 *      (only lobby members can reach these; the guard at the end of
 *       lobbyRoutes.ts runs first because this router is mounted after it)
 *  - Old group chat API:                    /api/groupchats...
 *      (the real chat is /api/lobbies/:id/messages in lobbyRoutes.ts)
 *
 * When one of these is built for real, move it into the matching routes file.
 */
import { Router } from "express";
import { Restaurant } from "../db models/restaurant";

const router = Router();

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
