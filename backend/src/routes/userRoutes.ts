/**
 * userRoutes.ts
 *
 * Regular user accounts:
 *  - POST   /api/users      create an account (and log in)
 *  - GET    /api/users/:id  read your own profile
 *  - PATCH  /api/users/:id  update your own username/email
 *  - DELETE /api/users/:id  delete your own account
 * Users can only read or change their own account (requireOwnProfile).
 */
import { Router, type Request } from "express";
import mongoose from "mongoose";
import { User } from "../models/user";
import { hashPassword } from "../services/password";
import { establishSession, revokeUserSessions } from "../services/session";
import { HttpError, isDuplicateKeyError } from "../utils/errors";

const router = Router();

// Only the logged-in user can read or change their own account.
function requireOwnProfile(req: Request) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new HttpError(400, "Invalid user ID.");
  if (!req.identity?.userId) throw new HttpError(401, "Login is required.");
  if (req.identity.userId !== String(req.params.id).toLowerCase()) throw new HttpError(403, "You can only access your own account.");
}

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a user.
 *     tags:
 *       - user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Username
 *               - Password
 *               - Email
 *             properties:
 *               Username:
 *                 type: string
 *                 example: "Billy"
 *               Password:
 *                 type: string
 *                 example: "Password"
 *               Email:
 *                 type: string
 *                 example: "example@example.com"
 *     responses:
 *       201:
 *         description: User created successfully.
 *       400:
 *         description: Invalid input.
 */
router.post("/api/users", async (req, res) => {
  console.log("User creation request received");

  let user = {
    username: req.body.username,
    password: req.body.password,
    email: req.body.email,
  };

  if (!user.username || !user.password || !user.email) {
    return res.status(400).json({
      message: "Username, password, and email are required.",
    });
  }

  try {
    const createdUser = await User.create({
      username: user.username,
      email: user.email,
      password: await hashPassword(user.password),
    });

    await establishSession(req, res, { id: String(createdUser._id), username: createdUser.username, email: createdUser.email });
    return res.status(201).json({
      message: "User created",
      user: {
        id: createdUser._id,
        username: createdUser.username,
        email: createdUser.email,
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return res.status(409).json({
        message: "A user with that email already exists.",
      });
    }

    console.error("Failed to create user:", error);
    return res.status(500).json({ message: "Failed to create user." });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get the logged-in user's own profile by ID.
 *     security: [{ lobbySession: [] }]
 *     tags:
 *       - user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "55"
 *     responses:
 *       200:
 *         description: User information returned successfully.
 *       400:
 *         description: Invalid user ID.
 *       404:
 *         description: User not found.
 */
router.get("/api/users/:id", async (req, res) => {
  requireOwnProfile(req);
  const userId = req.params.id;

  const user = await User.findById(userId).select("username email").lean();

  if (user) {
    return res.status(200).json({ id: user._id, username: user.username, email: user.email });
  }

  return res.status(404).json({
    message: "Failed to fetch user. Invalid id?",
  });
});

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Update the logged-in user's own username or email.
 *     security: [{ lobbySession: [] }]
 *     tags:
 *       - user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "55"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "Billy"
 *               email:
 *                 type: string
 *                 example: "example@example.com"
 *     responses:
 *       200:
 *         description: User updated successfully.
 *       400:
 *         description: Invalid input or user ID.
 *       404:
 *         description: User not found.
 */
router.patch("/api/users/:id", async (req, res) => {
  requireOwnProfile(req);
  const userId = req.params.id;

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !Object.keys(body).length || Object.keys(body).some(key => !["username", "email"].includes(key))) {
    return res.status(400).json({ message: "Provide username and/or email only. Password changes are not supported here." });
  }
  const updates: { username?: string; email?: string } = {};
  if (body.username !== undefined) {
    if (typeof body.username !== "string" || !body.username.trim() || body.username.trim().length > 100) {
      return res.status(400).json({ message: "username must be between 1 and 100 characters." });
    }
    updates.username = body.username.trim();
  }
  if (body.email !== undefined) {
    if (typeof body.email !== "string" || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return res.status(400).json({ message: "A valid email is required." });
    }
    updates.email = body.email.trim().toLowerCase();
  }
  try {
    const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).select("username email").lean();
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.status(200).json({ message: "User updated", user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    if (isDuplicateKeyError(error)) return res.status(409).json({ message: "A user with that email already exists." });
    throw error;
  }
});

/** @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete the logged-in user's own account and revoke all sessions.
 *     security: [{ lobbySession: [] }]
 *     tags: [user]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: User deleted successfully. }
 *       404: { description: User not found. }
 */
router.delete("/api/users/:id", async (req, res) => {
  requireOwnProfile(req);
  const userId = req.params.id;

  const user = await User.findByIdAndDelete(userId);
  if (!user) return res.status(404).json({ message: "User not found." });
  await revokeUserSessions(String(user._id));
  res.clearCookie("forkoff_session", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });

  return res.status(200).json({
    message: "User deleted",
    userId: userId,
  });
});

export default router;
