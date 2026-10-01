// In future, hold user authorization logic, including login and user account creation
import argon2 from "argon2";

async function hashPassword(password: string): Promise<string> {
  const hashword: string = await argon2.hash(password);
  return hashword;
}

async function validatePassword(password: string): Promise<boolean> {
  // Connect to db, authorize the user login.
  // only authroize password right now as we wait for db
  const secret: string = "password";
  const authorized: boolean = await argon2.verify(password, secret);

  return authorized;
}
