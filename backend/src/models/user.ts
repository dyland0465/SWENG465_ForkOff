import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "partner", "admin"], default: "user" },
  restaurantIds: { type: [{ type: Schema.Types.ObjectId, ref: "Restaurant" }], default: [] },
  partnerStatus: { type: String, enum: ["pending", "approved", "rejected"] },
   requestedRestaurant: {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
  },
}, {
  timestamps: true
}
);

// changed it to use users in mongodb instead of user
export const User = mongoose.model("User", userSchema, "users");