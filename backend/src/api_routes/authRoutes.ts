/**
 * authRoutes.ts
 *
 * POST /api/auth/login — checks a username/email and password (argon2) and logs
 * the user in. Session check and logout (/api/auth/session, /api/auth/logout)
 * live in lobbyRoutes.ts because guests in lobbies use them too.
 */
import { Router } from "express";
import { User } from "../db_models/user";
import { validatePassword } from "../services/passwordHashing";
import { establishSession } from "../services/session";

const router = Router();

// Authorize user login.
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login using a username or email and password.
 *     tags:
 *       - auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "Billy"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "billy@example.com"
 *               password:
 *                 type: string
 *                 example: "Password"
 *     responses:
 *       200:
 *         description: User logged in successfully.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Invalid username/email or password.
 */
router.post("/api/auth/login", async (req, res) => {
  const rawIdentifier = req.body?.username ?? req.body?.Username ?? req.body?.email ?? req.body?.Email;
  const rawPassword = req.body?.password ?? req.body?.Password;
  if (typeof rawIdentifier !== "string" || !rawIdentifier.trim() || rawIdentifier.trim().length > 254 ||
      typeof rawPassword !== "string" || !rawPassword || rawPassword.length > 128) {
    return res.status(400).json({ message: "Username or email and password are required." });
  }
  const identifier = rawIdentifier.trim();
  const password = rawPassword;

  const user = await User.findOne({
    $or: [
      { username: identifier },
      { email: identifier.toLowerCase() },
    ],
  });

  if (!user || !(await validatePassword(password, user.password))) {
    return res.status(401).json({
      message: "Invalid username/email or password.",
    });
  }

  await establishSession(req, res, { id: String(user._id), username: user.username, email: user.email });
  return res.status(200).json({
    message: "User authorized to login.",
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role ?? "user",
      partnerStatus: user.partnerStatus ?? null,
    },
  });
});

export default router;
