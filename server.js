// server.js

const express = require('express');
const app = express();
app.use(express.json());

// A simple array to act as our "database"
let products = [];

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

// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));