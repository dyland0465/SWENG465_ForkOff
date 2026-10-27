import { Session } from "../db models/session";
import mongoose from "mongoose";
import { GroupchatMessage } from "../db models/groupchat";
import { Lobby } from "../db models/lobby";
import { Restaurant } from "../db models/restaurant";
import { User } from "../db models/user";
import { Vote } from "../db models/vote";

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
