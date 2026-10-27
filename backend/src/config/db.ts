import { Session } from "../models/session";
import mongoose from "mongoose";
import { GroupchatMessage } from "../models/groupchat";
import { Lobby } from "../models/lobby";
import { Restaurant } from "../models/restaurant";
import { User } from "../models/user";
import { Vote } from "../models/vote";

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
