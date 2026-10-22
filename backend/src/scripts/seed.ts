import { randomUUID } from "node:crypto";
import { hashPassword } from "../services/auth";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { User } from "../models/user";
import { Lobby } from "../models/lobby";


dotenv.config();

async function seed() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is not defined");
    }

    await mongoose.connect(uri);

    console.log("Connected to MongoDB");

    await User.deleteMany({});
    await Lobby.deleteMany({});

    const user1 = await User.create({
      username: "test1",
      email: "test1@example.com",
      password: await hashPassword("test-password-123")
    })

    const user2 = await User.create({
      username: "test2",
      email: "test2@example.com",
      password: await hashPassword("test-password-1234")
    })

    const hostMemberId = randomUUID();
    const lobby = await Lobby.create({
      lobbyCode: "12354",
      name: "lobby1",
      hostMemberId,
      nextJoinOrder: 2,
      revision: 0,
      members: [user1, user2].map((user, index) => ({ memberId: index === 0 ? hostMemberId : randomUUID(), identityKey: `user:${user._id}`, userId: user._id, type: "user", displayName: user.username, joinOrder: index, joinedAt: new Date() })),
      status: "waiting",
      filters: {
        maxDistance: 10,
        minimumRating: 4,
        categories: ["Italian", "Mexican"],
        openNow: true
      }

    });

    console.log("Created users:\n");
    console.log(user1);
    console.log(user2);

    console.log("Created lobby:");
    console.log(lobby);

  }
  catch (error) {
    console.error("Failed to seed db:", error);
  }
  finally {
    await mongoose.disconnect();
  }
}

seed();



