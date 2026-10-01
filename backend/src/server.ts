import app from "./app";
import dotenv from "dotenv";
import { connectDB } from "./Config/db";


// Start the server
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
    try {
        await connectDB(); 
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();


