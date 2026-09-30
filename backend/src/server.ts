import express from "express";
const app = express();
app.use(express.json()); 

// TODO: Connect auth to db
// Authorize user login. Current understanding is that we get plain text password,
// encode with salt+token, compare to the db password. If same,
// authorize logon, else, decline the login.
// SWAGGER: Authorize user login with inputs of username and password.
app.post('/api/auth/login', (req, res) => {
  let user = {
    username: req.body.username,
    password: req.body.password,
    email: req.body.email
  };

  let secret : String = "Password"; // Predefined password for testing, compare to db in future

  if(user.password === secret){
    res.status(201).json({ message: "User authorized to login."});
  } else {
    res.status(400).json({ message: "User not authorized to login." });
  }
});

// POST endpoint to create a user.
// Return 201 on successful user creation, 400 on error.
// SWAGGER: Create a user with inputs of username, password, email. Must meet valid criteria for creation.
app.post('/api/users', (req, res) => {
  console.log("User creation request received");
  let user = {
    username: req.body.username,
    password: req.body.password,
    email: req.body.email
  };

  // TODO:
  // At this point, we should verify that:
  // Username is valid
  // Password meets minimum requirements
  // Valid email.

  if (user) {
    console.log(user);
    res.status(201).json({ message: "User created"});
  } else {
    // TODO:
    // In the future, give more detailed information to the user depending on what failed on creation.
    res.status(400).json({ message: "Invalid request" });
  }
});

// TODO: Connect this to the db to grab available information about a user,
// such as username and email
// GET endpoint to grab all of users information by id
// SWAGGER: Grab a users information by id, returning username, email, etc.
app.get('/api/users/:id', (req, res) => {
  let user = {
    username: "User",
    email: "Example@example.com"
  };

  if(user){
    res.status(200).json(user);
  } else {
    res.status(400).json({ message: "Failed to fetch user. Invalid id?"});
  }


});

// SWAGGER: Edit username, password, or email of user by id.
// TODO: implement connection to db to edit user info
app.patch('/api/users/:id', (req, res) => {
  let success : boolean = false;
  let userId : number = req.body.id;

  if (success){
    res.status(200).json({ message: "Success"});
  } else {
    res.status(400).json({ message: "Failed"});
  }
});

// SWAGGER: Delete a user by id.
// TODO: implement connection to db to delete user
app.delete('/api/users:id', (req, res) => {
  let success : boolean = false;
  let userId : number = req.body.id;

  if (success){
    res.status(200).json({ message: "Success"});
  } else {
    res.status(400).json({ message: "Failed"});
  }
});

// SWAGGER: Get a restaurants info by id.
// TODO: Connect to db to actually grab restaurant info.
app.get('/api/restaurants/:id', (req, res) => {  //pulla the resturaunt based on the ID and return the menu for that restaurant.
  const restaurantId = req.params.id; //get restaurant id from request parameters

  const info = {
    restaurantId: 1, //temp sets id to id so that it displays for testing. 
    restaurantName: "The Bistro Grill", //basic info about the restaurant. 
    currency: "USD",
    categories: [
      {
        name: "Appetizers", //appetizers
        items: [
          { id: 101, name: "Crispy Calamari", description: "Served with garlic lemon aioli", price: 12.50 },
          { id: 102, name: "Truffle Fries", description: "Parmesan, parsley, and truffle oil", price: 8.00 }
        ]
      },
      {
        name: "Main Courses", //main courses
        items: [
          { id: 201, name: "Grilled Ribeye Steak", description: "12oz ribeye with rosemary butter and mashed potatoes", price: 34.00 },
          { id: 202, name: "Wild Mushroom Risotto", description: "Arborio rice, porcini, white wine, and pecorino", price: 22.00 }
        ]
      },
      {
        name: "Desserts & Drinks", //deserts
        items: [
          { id: 301, name: "Classic Tiramisu", description: "Espresso-soaked ladyfingers with mascarpone cream", price: 9.00 },
          { id: 302, name: "House Lemonade", description: "Freshly squeezed with mint", price: 4.50 }
        ]
      }
    ]
  };

  res.status(200).json(info);
});

// SWAGGER: Edit a restaurants info by id 
// TODO: Connect to db to actually edit restaurant info.
app.patch('/api/restaurants/:id', (req, res) =>{

});

//2 lobbies
let lobbies = [];


//Post endpoint to create lobby
app.post('/api/lobby/create', (req, res) => {
  const { name, restaurant, numPlayers } = req.body;//get lobby information from request body 


  if (!name || !restaurant || typeof numPlayers !== 'number') { //check if all required fields were provided 
    return res.status(400).json({
      error: "name, restaurant, and number of players required"
    });
  }

  //create new lobby object
  const newLobby = {
    LobbyId: lobbies.length + 1,
    name,
    restaurant,
    numPlayers
  };

  //add lobby to array
  lobbies.push(newLobby);

  //return status 201 if everything works 
  res.status(201).json(newLobby);

});

//Get endpoint to get lobby information
app.get('/api/lobby/info/:id', (req, res) => {
  const LobbyId = req.params.id; //get lobby id

  //search lobby list for one with the matching ID
  const lobby = lobbies.find(lobby => lobby.LobbyId === LobbyId);

  //If no lobby with the specified ID exists, return 404
  if (!lobby) {
    return res.status(404).json({
      error: "Lobby not found"
    });
  }

  //return lobby information if found
  res.status(200).json(lobby);
});

//Group chat
let groupChats = [];

//get endpoints for all groupchats
app.get('/api/groupchats', (req, res) => { res.status(200).json(groupChats); });

//post endpoints for creating new groupchat
app.post('/api/groupchats', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({
      error: "Group chat name is required"
    });
  }
  const newGroupChat = {
    id: groupChats.length + 1,
    name: name,
    members: [],
    messages: []
  };

  groupChats.push(newGroupChat);
  res.status(201).json(newGroupChat);
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
