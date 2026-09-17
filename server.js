// server.js

const express = require('express');
const app = express();
app.use(express.json());

// A simple array to act as our "database"
//let products = [];

/**
// GET endpoint to retrieve all products
app.get('/api/products', (req, res) => {
    // Return the array of products
});

// POST endpoint to create a new product
app.post('/api/products', (req, res) => {
    // 1. Get data from the request body
    // 2. Add validation: Check if required fields exist
    // 3. If valid, create a new product object and push to the array
    // 4. Respond with a 201 Created status code and the new product object
});
 */


app.post('/api/users/create', (req, res) => {
    console.log("User creation request received");    
    let user = req.body.username;

    if(user) {
        console.log(user);
        res.status(201).json({ message: "User created", username: user });
    } else {
        res.status(400).json({ message: "Invalid request" });
    }
});

app.get('/api/users/info/:id', (req, res) => {
    let info = "Info";
    res.status(200).json(info);
});

app.get('/api/Restaurant/info/menu/:id', (req, res) => {
    const restaurantId = req.params.id;

    const info = {
        restaurantId: restaurantId,
        restaurantName: "The Bistro Grill",
        currency: "USD",
        categories: [
            {
                name: "Appetizers",
                items: [
                    { id: 101, name: "Crispy Calamari", description: "Served with garlic lemon aioli", price: 12.50 },
                    { id: 102, name: "Truffle Fries", description: "Parmesan, parsley, and truffle oil", price: 8.00 }
                ]
            },
            {
                name: "Main Courses",
                items: [
                    { id: 201, name: "Grilled Ribeye Steak", description: "12oz ribeye with rosemary butter and mashed potatoes", price: 34.00 },
                    { id: 202, name: "Wild Mushroom Risotto", description: "Arborio rice, porcini, white wine, and pecorino", price: 22.00 }
                ]
            },
            {
                name: "Desserts & Drinks",
                items: [
                    { id: 301, name: "Classic Tiramisu", description: "Espresso-soaked ladyfingers with mascarpone cream", price: 9.00 },
                    { id: 302, name: "House Lemonade", description: "Freshly squeezed with mint", price: 4.50 }
                ]
            }
        ]
    };

    res.status(200).json(info);
});

//create lobby
app.post('/api/lobby/create' => {
    const {name, restaurant, numPlayers } = req.body;


    if (!name || !restaurant || typeof numPlayers !== 'number') {
       return res.status(400).json({
          error: "name, restaurant, and number of players required"
       });
    }

    const newLobby = {
    LobbyId: LobbyId,
    name,
    restaurant,
    numPlayers
  };
  
   
res.status(201).json(newLobby);

});


app.get('/api/lobby/create' => {
  const info = 'info';
});















// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
