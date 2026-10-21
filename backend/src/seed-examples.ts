import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "./Config/db";
import { GroupchatMessage } from "./models/groupchat";
import { Lobby } from "./models/lobby";
import { User } from "./models/user";
import { Vote } from "./models/vote";
import { hashPassword } from "./services/auth";

dotenv.config();

async function seedExamples(): Promise<void> {
  const lobbyId = new mongoose.Types.ObjectId("66f000000000000000000001");
  const messageId = new mongoose.Types.ObjectId("66f000000000000000000002");
  const restaurantId = "example-restaurant";

  try {
    await connectDB();

    const user = await User.findOneAndUpdate(
      { email: "example.user@example.invalid" },
      {
        $setOnInsert: {
          username: "example-user",
          email: "example.user@example.invalid",
          password: await hashPassword(randomBytes(32).toString("hex")),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    if (!user) throw new Error("Could not create the example user.");

    const lobby = await Lobby.findOneAndUpdate(
      { _id: lobbyId },
      {
        $setOnInsert: {
          name: "Example Lobby",
          lobbyCode: "EXAMPL",
          hostID: user._id,
          members: [user._id],
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    if (!lobby) throw new Error("Could not create the example lobby.");

    await GroupchatMessage.findOneAndUpdate(
      { _id: messageId },
      {
        $setOnInsert: {
          userId: user._id,
          message: "Example group chat message",
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    await Vote.findOneAndUpdate(
      {
        lobbyID: lobby._id,
        userID: user._id,
        restaurantID: restaurantId,
      },
      {
        $setOnInsert: {
          lobbyID: lobby._id,
          userID: user._id,
          restaurantID: restaurantId,
          vote: "yes",
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    console.log(
      `Example documents ready in ${mongoose.connection.name}: user=${user._id}, lobby=${lobby._id}, groupchat=${messageId}, vote restaurant=${restaurantId}`,
    );
  } catch (error) {
    console.error("Failed to seed example documents:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void seedExamples();
