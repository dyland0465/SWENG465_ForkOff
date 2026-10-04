import argon2 from "argon2";
import { User } from "../modules/user";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function validatePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function ensureAdminUser(): Promise<void> {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "password";

  await User.findOneAndUpdate(
    { email },
    {
      $set: {
        username,
        email,
        password: await hashPassword(password),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(`Admin user ready: ${email}`);
}
