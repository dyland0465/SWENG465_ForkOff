import { createServer } from "node:http";
import { attachRealtime } from "./services/realtime";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import app from "./app";

dotenv.config();

// Start the server
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await connectDB();
    const server = createServer(app);
    attachRealtime(server);
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
