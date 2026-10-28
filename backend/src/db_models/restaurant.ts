import mongoose, { Schema } from "mongoose";

const restaurantSchema = new Schema(
  {
    placeId: { type: String, required: true, unique: true, trim: true },
    cachedPlace: { type: Schema.Types.Mixed },
    cachedAt: { type: Date },
    cachedPhoto: { type: Buffer, select: false },
    cachedPhotoType: { type: String },
    searchCache: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "restaurants",
  },
);

export const Restaurant = mongoose.model("Restaurant", restaurantSchema);
