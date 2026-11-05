import mongoose from "mongoose";
import type { Request } from "express";
import { Restaurant } from "../db_models/restaurant";
import { HttpError } from "../utils/errors";
export const restaurantFilter = (id: string) => mongoose.isObjectIdOrHexString(id)
  ? { $or: [{ placeId: id }, { _id: new mongoose.Types.ObjectId(id) }] } : { placeId: id };
export async function requireManagedRestaurant(req: Request) {
  if (!req.identity?.userId) throw new HttpError(401, "Login is required.");
  const restaurant = await Restaurant.findOne(restaurantFilter(String(req.params.id)));
  if (!restaurant) throw new HttpError(404, "Restaurant not found.");
  const identity = req.identity;
  if (identity.role !== "admin" && !(identity.role === "partner" && identity.partnerStatus === "approved" && identity.restaurantIds?.includes(String(restaurant._id))))
    throw new HttpError(403, "Only an approved owner or an admin can manage this restaurant.");
  return restaurant;
}
