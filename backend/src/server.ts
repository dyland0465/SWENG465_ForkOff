import dotenv from "dotenv";
import { connectDB } from "./config/db";
import app from "./app";
import { ensureAdminUser } from "./services/auth";

dotenv.config();

// Start the server
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await connectDB();
    await ensureAdminUser();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
