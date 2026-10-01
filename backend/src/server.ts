import express from "express";
const app = express();
app.use(express.json()); 

// TODO: Connect auth to db
// Authorize user login.
// Eventually:
// 1. Find user by username/email in database.
// 2. Compare entered password against stored password hash.
// 3. If valid, return authentication token/session.
// SWAGGER: Authorize user login with inputs of username and password.
app.post('/api/auth/login', (req, res) => {
  let user = {
    username: req.body.username,
    password: req.body.password
  };

  let secret: string = "Password"; // Temporary test password

  if (!user.username || !user.password) {
    return res.status(400).json({
      message: "Username and password are required."
    });
  }

  if (user.password === secret) {
    return res.status(200).json({
      message: "User authorized to login."
    });
  }

  return res.status(401).json({
    message: "User not authorized to login."
  });
});


// POST endpoint to create a user.
// Return 201 on successful user creation, 400 on error.
// SWAGGER: Create a user with inputs of username, password, email.
app.post('/api/users', (req, res) => {
  console.log("User creation request received");

  let user = {
    username: req.body.username,
    password: req.body.password,
    email: req.body.email
  };

  if (!user.username || !user.password || !user.email) {
    return res.status(400).json({
      message: "Username, password, and email are required."
    });
  }

  // TODO:
  // Validate username
  // Validate password requirements
  // Validate email
  // Check for duplicate username/email
  // Hash password before saving

  console.log(user);

  return res.status(201).json({
    message: "User created",
    user: {
      username: user.username,
      email: user.email
    }
  });
});


// GET endpoint to grab user information by id.
// SWAGGER: Grab a user's information by id.
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  // TODO: Query user from database using userId
  let user = {
    id: userId,
    username: "User",
    email: "Example@example.com"
  };

  if (user) {
    return res.status(200).json(user);
  }

  return res.status(404).json({
    message: "Failed to fetch user. Invalid id?"
  });
});


// SWAGGER: Edit username, password, or email of user by id.
// TODO: Implement connection to db to edit user info
app.patch('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  let updates = {
    username: req.body.username,
    password: req.body.password,
    email: req.body.email
  };

  // TODO:
  // Find user by userId
  // Validate provided fields
  // Hash password if password changes
  // Apply updates

  return res.status(200).json({
    message: "User updated",
    userId: userId,
    updates: updates
  });
});


// SWAGGER: Delete a user by id.
// TODO: Implement connection to db to delete user
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  // TODO: Delete user from database

  return res.status(200).json({
    message: "User deleted",
    userId: userId
  });
});


// SWAGGER: Get a restaurant's info by id.
// TODO: Connect to db to actually grab restaurant info.
app.get('/api/restaurants/:id', (req, res) => {
  const restaurantId = req.params.id;

  const info = {
    restaurantId: restaurantId,
    restaurantName: "The Bistro Grill",
    address: "123 Main Street",
    phone: "555-555-5555",
    website: "https://example.com",
    currency: "USD",
    categories: [
      "American",
      "Grill"
    ]
  };

  return res.status(200).json(info);
});


// SWAGGER: Edit a restaurant's info by id.
// TODO: Connect to db to actually edit restaurant info.
app.patch('/api/restaurants/:id', (req, res) => {
  const restaurantId = req.params.id;

  let updates = {
    restaurantName: req.body.restaurantName,
    address: req.body.address,
    phone: req.body.phone,
    website: req.body.website,
    categories: req.body.categories
  };

  // TODO: Update restaurant in database

  return res.status(200).json({
    message: "Restaurant updated",
    restaurantId: restaurantId,
    updates: updates
  });
});


// SWAGGER: Delete restaurant custom information by id.
// TODO: Connect to db.
app.delete('/api/restaurants/:id', (req, res) => {
  const restaurantId = req.params.id;

  // TODO: Delete custom restaurant info from database

  return res.status(200).json({
    message: "Restaurant deleted",
    restaurantId: restaurantId
  });
});


// SWAGGER: Get partner-entered restaurant menu.
// TODO: Fetch menu from database.
app.get('/api/restaurants/:id/menu', (req, res) => {
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
            price: 12.50
          },
          {
            id: 102,
            name: "Truffle Fries",
            description: "Parmesan, parsley, and truffle oil",
            price: 8.00
          }
        ]
      },
      {
        name: "Main Courses",
        items: [
          {
            id: 201,
            name: "Grilled Ribeye Steak",
            description: "12oz ribeye with rosemary butter and mashed potatoes",
            price: 34.00
          }
        ]
      }
    ]
  };

  return res.status(200).json(menu);
});


// SWAGGER: Edit partner-entered restaurant menu.
// TODO: Save updates to database.
app.patch('/api/restaurants/:id/menu', (req, res) => {
  const restaurantId = req.params.id;
  const menu = req.body.menu;

  if (!menu) {
    return res.status(400).json({
      message: "Menu data is required."
    });
  }

  return res.status(200).json({
    message: "Restaurant menu updated",
    restaurantId: restaurantId,
    menu: menu
  });
});


// SWAGGER: Get individual restaurant analytics.
// TODO: Generate analytics from database votes/views/swipes.
app.get('/api/restaurants/:id/analytics', (req, res) => {
  const restaurantId = req.params.id;

  const analytics = {
    restaurantId: restaurantId,
    views: 125,
    likes: 80,
    dislikes: 30,
    matches: 45,
    selectionRate: 0.36
  };

  return res.status(200).json(analytics);
});


// SWAGGER: Get restaurant information from Google Places.
// TODO: Connect to Google Places API.
app.get('/api/places/:id', (req, res) => {
  const placeId = req.params.id;

  const place = {
    placeId: placeId,
    displayName: "Example Restaurant",
    address: "123 Main Street",
    rating: 4.5,
    priceLevel: 2,
    openNow: true
  };

  return res.status(200).json(place);
});


// SWAGGER: Get restaurant photos from Google Places.
// TODO: Fetch photos from Google Places API.
app.get('/api/places/:id/photos', (req, res) => {
  const placeId = req.params.id;

  const photos = [
    {
      id: 1,
      url: "https://example.com/photo1.jpg"
    },
    {
      id: 2,
      url: "https://example.com/photo2.jpg"
    }
  ];

  return res.status(200).json({
    placeId: placeId,
    photos: photos
  });
});


// SWAGGER: Get restaurant reviews from Google Places.
// TODO: Fetch reviews from Google Places API.
app.get('/api/places/:id/reviews', (req, res) => {
  const placeId = req.params.id;

  const reviews = [
    {
      author: "Test User",
      rating: 5,
      text: "Great restaurant."
    },
    {
      author: "Example User",
      rating: 4,
      text: "Good food."
    }
  ];

  return res.status(200).json({
    placeId: placeId,
    reviews: reviews
  });
});


// SWAGGER: Create a lobby.
// TODO: Save lobby to database.
app.post('/api/lobbies', (req, res) => {
  const lobby = {
    id: "ABC123",
    name: req.body.name,
    hostId: req.body.hostId,
    maxDistance: req.body.maxDistance,
    createdAt: new Date()
  };

  if (!lobby.hostId) {
    return res.status(400).json({
      message: "Host ID is required."
    });
  }

  return res.status(201).json({
    message: "Lobby created",
    lobby: lobby
  });
});


// SWAGGER: Get lobby information.
app.get('/api/lobbies/:id', (req, res) => {
  const lobbyId = req.params.id;

  const lobby = {
    id: lobbyId,
    name: "Dinner Group",
    hostId: "1",
    memberCount: 3,
    status: "waiting"
  };

  return res.status(200).json(lobby);
});


// SWAGGER: Edit lobby settings.
app.patch('/api/lobbies/:id', (req, res) => {
  const lobbyId = req.params.id;

  const updates = {
    name: req.body.name,
    status: req.body.status
  };

  return res.status(200).json({
    message: "Lobby updated",
    lobbyId: lobbyId,
    updates: updates
  });
});


// SWAGGER: Delete lobby.
app.delete('/api/lobbies/:id', (req, res) => {
  const lobbyId = req.params.id;

  return res.status(200).json({
    message: "Lobby deleted",
    lobbyId: lobbyId
  });
});


// SWAGGER: Join lobby.
app.post('/api/lobbies/:id/join', (req, res) => {
  const lobbyId = req.params.id;
  const userId = req.body.userId;

  if (!userId) {
    return res.status(400).json({
      message: "User ID is required."
    });
  }

  return res.status(200).json({
    message: "User joined lobby",
    lobbyId: lobbyId,
    userId: userId
  });
});


// SWAGGER: Leave lobby.
app.post('/api/lobbies/:id/leave', (req, res) => {
  const lobbyId = req.params.id;
  const userId = req.body.userId;

  if (!userId) {
    return res.status(400).json({
      message: "User ID is required."
    });
  }

  return res.status(200).json({
    message: "User left lobby",
    lobbyId: lobbyId,
    userId: userId
  });
});


// SWAGGER: Get lobby members.
app.get('/api/lobbies/:id/members', (req, res) => {
  const lobbyId = req.params.id;

  const members = [
    {
      id: 1,
      username: "UserOne"
    },
    {
      id: 2,
      username: "UserTwo"
    }
  ];

  return res.status(200).json({
    lobbyId: lobbyId,
    members: members
  });
});


// SWAGGER: Get lobby restaurants.
app.get('/api/lobbies/:id/restaurants', (req, res) => {
  const lobbyId = req.params.id;

  const restaurants = [
    {
      id: 1,
      name: "Restaurant One",
      rating: 4.4
    },
    {
      id: 2,
      name: "Restaurant Two",
      rating: 4.7
    }
  ];

  return res.status(200).json({
    lobbyId: lobbyId,
    restaurants: restaurants
  });
});


// SWAGGER: Get lobby filters.
app.get('/api/lobbies/:id/filters', (req, res) => {
  const lobbyId = req.params.id;

  const filters = {
    maxDistance: 10,
    minimumRating: 4,
    maxPriceLevel: 3,
    categories: [
      "American",
      "Mexican"
    ],
    openNow: true,
    alcoholAvailable: false
  };

  return res.status(200).json({
    lobbyId: lobbyId,
    filters: filters
  });
});


// SWAGGER: Edit lobby filters.
app.patch('/api/lobbies/:id/filters', (req, res) => {
  const lobbyId = req.params.id;

  const filters = {
    maxDistance: req.body.maxDistance,
    minimumRating: req.body.minimumRating,
    maxPriceLevel: req.body.maxPriceLevel,
    categories: req.body.categories,
    openNow: req.body.openNow,
    alcoholAvailable: req.body.alcoholAvailable
  };

  return res.status(200).json({
    message: "Lobby filters updated",
    lobbyId: lobbyId,
    filters: filters
  });
});


// SWAGGER: Submit restaurant vote/swipe.
app.post('/api/lobbies/:id/votes', (req, res) => {
  const lobbyId = req.params.id;

  const vote = {
    userId: req.body.userId,
    restaurantId: req.body.restaurantId,
    vote: req.body.vote
  };

  if (
    !vote.userId ||
    !vote.restaurantId ||
    !["like", "dislike", "veto"].includes(vote.vote)
  ) {
    return res.status(400).json({
      message: "Invalid vote request."
    });
  }

  return res.status(201).json({
    message: "Vote submitted",
    lobbyId: lobbyId,
    vote: vote
  });
});


// SWAGGER: Get game results.
app.get('/api/lobbies/:id/results', (req, res) => {
  const lobbyId = req.params.id;

  const results = [
    {
      restaurantId: 1,
      restaurantName: "Applebee's",
      votes: 4,
      totalMembers: 5
    },
    {
      restaurantId: 2,
      restaurantName: "Taco Bell",
      votes: 3,
      totalMembers: 5
    }
  ];

  return res.status(200).json({
    lobbyId: lobbyId,
    results: results
  });
});


// SWAGGER: Create a group chat.
app.post('/api/groupchats', (req, res) => {
  const groupchat = {
    id: "CHAT123",
    name: req.body.name,
    creatorId: req.body.creatorId
  };

  if (!groupchat.creatorId) {
    return res.status(400).json({
      message: "Creator ID is required."
    });
  }

  return res.status(201).json({
    message: "Group chat created",
    groupchat: groupchat
  });
});


// SWAGGER: Get members of a group chat.
app.get('/api/groupchats/:id/members', (req, res) => {
  const groupchatId = req.params.id;

  const members = [
    {
      id: 1,
      username: "UserOne"
    },
    {
      id: 2,
      username: "UserTwo"
    }
  ];

  return res.status(200).json({
    groupchatId: groupchatId,
    members: members
  });
});


// SWAGGER: Get messages of a group chat.
app.get('/api/groupchats/:id/messages', (req, res) => {
  const groupchatId = req.params.id;

  const messages = [
    {
      id: 1,
      senderId: 1,
      message: "Where should we eat?",
      sentAt: new Date()
    },
    {
      id: 2,
      senderId: 2,
      message: "I'm good with anything.",
      sentAt: new Date()
    }
  ];

  return res.status(200).json({
    groupchatId: groupchatId,
    messages: messages
  });
});


// SWAGGER: Edit a group chat.
app.patch('/api/groupchats/:id', (req, res) => {
  const groupchatId = req.params.id;

  const updates = {
    name: req.body.name
  };

  return res.status(200).json({
    message: "Group chat updated",
    groupchatId: groupchatId,
    updates: updates
  });
});


// SWAGGER: Delete a group chat.
app.delete('/api/groupchats/:id', (req, res) => {
  const groupchatId = req.params.id;

  return res.status(200).json({
    message: "Group chat deleted",
    groupchatId: groupchatId
  });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
