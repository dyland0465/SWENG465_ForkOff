import mongoose from "mongoose";
const db = mongoose.connection.db;

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in the environment variables");
  }
  await mongoose.connect(uri, {
    dbName: "main"
  });
  console.log("Connected to MongoDB successfully");
}
