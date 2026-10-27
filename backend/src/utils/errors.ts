/**
 * errors.ts
 *
 * Shared error helpers for the routes:
 *  - HttpError: throw new HttpError(404, "Not found.") from any route and the error
 *    handler in app.ts sends that status and message as JSON.
 *  - isDuplicateKeyError: true when MongoDB rejects a save because a unique field
 *    (like email) is already taken.
 *  - handlePlacesError: turns a Google Places failure into the right response
 *    (503 not configured, 404 not found, 502 Google error, 500 anything else).
 */
import type { Response } from "express";
import { GooglePlacesError } from "../services/googlePlaces";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000,
  );
}

export function handlePlacesError(res: Response, error: unknown, context: string) {
  if (error instanceof GooglePlacesError) {
    console.error(`${context} Google Places responded ${error.statusCode}: ${error.message}`);
    const status = error.statusCode === 503 ? 503 : error.statusCode === 404 ? 404 : 502;
    const message =
      status === 503
        ? "Google Places is not configured."
        : status === 404
          ? "Google Place not found."
          : "Google Places request failed.";
    return res.status(status).json({ message, providerStatus: error.statusCode });
  }

  console.error(context, error);
  return res.status(500).json({ message: "Failed to process restaurant request." });
}
