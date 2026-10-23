import mongoose, { Schema } from "mongoose";

const restaurantSchema = new Schema(
  {
    // Google Place IDs are the only Places API data persisted in MongoDB.
    placeId: { type: String, required: true, unique: true, trim: true },
  },
  {
    timestamps: true,
    collection: "restaurants",
  },
);

export const Restaurant = mongoose.model("Restaurant", restaurantSchema);
