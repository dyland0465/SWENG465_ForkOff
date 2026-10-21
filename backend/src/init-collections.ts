import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "./config/db";

dotenv.config();

async function initializeCollections(): Promise<void> {
  try {
    await connectDB();
    console.log("Atlas collection initialization complete.");
  } catch (error) {
    console.error("Failed to initialize Atlas collections:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void initializeCollections();
