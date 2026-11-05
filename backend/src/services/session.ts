import { EventEmitter } from "node:events";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Session } from "../db_models/session";
import { User } from "../db_models/user";

export type Identity = {
  key: string; userId?: string; username?: string; email?: string; role?: string; partnerStatus?: string; restaurantIds?: string[];};
declare global {
  namespace Express { interface Request { identity?: Identity } }
}
export const sessionEvents = new EventEmitter();
const cookieName = "forkoff_session";
const lifetime = 30 * 24 * 60 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const issuer = "forkoff";
const audience = "forkoff-web";

// Never fall back to a built-in secret. The same secret must be configured on
// every server instance, and rotating it intentionally invalidates all JWTs.
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 bytes of random secret data.");
  }
  return secret;
}

export function cookieToken(cookie = "") {
  return cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

export async function resolveIdentity(cookie?: string): Promise<Identity | undefined> {
  const token = cookieToken(cookie);
  if (!token || token.length > 4096) return;
  const secret = jwtSecret();
  let claims: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"], issuer, audience });
    if (typeof decoded === "string" || typeof decoded.sub !== "string" ||
        typeof decoded.jti !== "string" || typeof decoded.exp !== "number" ||
        typeof decoded.iat !== "number") return;
    claims = decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return;
    throw error;
  }
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session || session.identityKey !== claims.sub) return;
  if (session.userId) {
    const user = await User.findById(session.userId).select("username email role partnerStatus restaurantIds").lean();
    if (!user) return;
    return {
      key: session.identityKey, userId: String(user._id), username: user.username, email: user.email,
      role: user.role ?? "user", partnerStatus: user.partnerStatus ?? undefined,
      restaurantIds: (user.restaurantIds ?? []).map(String),
    };
  }
  return { key: session.identityKey };
}

// Browsers send Origin or Fetch Metadata on mutations. CLI clients may omit both.
export function allowedOrigin(origin: string | undefined, host: string | undefined, protocol = "http") {
  if (!origin) return true;
  const configured = process.env.APP_ORIGIN?.split(",").map(value => value.trim()) ?? [];
  try {
    const parsed = new URL(origin);
    return configured.length ? configured.includes(parsed.origin) : parsed.origin === `${protocol}://${host}`;
  } catch { return false; }
}

export function originGuard(req: Request, res: Response, next: NextFunction) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("sec-fetch-site") === "cross-site" || !allowedOrigin(req.get("origin"), req.get("host"), req.protocol))) {
    return res.status(403).json({ message: "Request origin is not allowed." });
  }
  next();
}

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  try { req.identity = await resolveIdentity(req.headers.cookie); next(); }
  catch (error) { next(error); }
}

export async function revokeSession(cookie?: string) {
  const token = cookieToken(cookie);
  if (token) { await Session.deleteOne({ tokenHash: hash(token) }); sessionEvents.emit("revoked", cookie); }
}

export async function revokeUserSessions(userId: string) {
  await Session.deleteMany({ userId });
  sessionEvents.emit("userRevoked", userId);
}

export async function establishSession(req: Request, res: Response, user?: { id: string; username: string; email: string }) {
  const secret = jwtSecret();
  await revokeSession(req.headers.cookie);
  const identityKey = user ? `user:${user.id}` : `guest:${randomUUID()}`;
  const token = jwt.sign({}, secret, { algorithm: "HS256", issuer, audience,
    subject: identityKey, jwtid: randomBytes(32).toString("hex"), expiresIn: lifetime / 1000 });
  await Session.create({ tokenHash: hash(token), identityKey, userId: user?.id, expiresAt: new Date(Date.now() + lifetime) });
  res.cookie(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: lifetime });
  req.identity = user ? { key: identityKey, userId: user.id, username: user.username, email: user.email } : { key: identityKey };
  return req.identity;
}

export function publicUser(identity?: Identity) {
  return identity?.userId ? {
    id: identity.userId, username: identity.username, email: identity.email,
    role: identity.role ?? "user", partnerStatus: identity.partnerStatus ?? null, restaurantIds: identity.restaurantIds ?? [],
  } : null;
}