import { Session } from "../db_models/session";
import mongoose from "mongoose";
import { GroupchatMessage } from "../db_models/groupchat";
import { Lobby } from "../db_models/lobby";
import { Restaurant } from "../db_models/restaurant";
import { User } from "../db_models/user";
import { Vote } from "../db_models/vote";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in the environment variables");
  }
  await mongoose.connect(uri, { dbName: "main" });
  const models = [User, Vote, Lobby, GroupchatMessage, Restaurant, Session];
  await Promise.all(models.map((model) => model.init()));
  console.log(
    `Connected to MongoDB database "main"; collections ready: ${models.map((model) => model.collection.name).join(", ")}`,
  );
}
