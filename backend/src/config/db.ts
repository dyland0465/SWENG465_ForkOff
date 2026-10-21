import mongoose from "mongoose";
import { GroupchatMessage } from "../modules/Groupchat";
import { Lobby } from "../modules/lobby";
import { User } from "../modules/user";
import { Vote } from "../modules/Vote";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in the environment variables");
  }
  await mongoose.connect(uri, { dbName: "main" });
  const models = [User, Vote, Lobby, GroupchatMessage];
  await Promise.all(models.map((model) => model.init()));
  console.log(
    `Connected to MongoDB database "main"; collections ready: ${models.map((model) => model.collection.name).join(", ")}`,
  );
  console.log("Connected to MongoDB successfully");
}
