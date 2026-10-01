import express from "express";
const app = express();
app.use(express.json()); 

// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
