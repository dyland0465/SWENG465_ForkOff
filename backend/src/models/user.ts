import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, {
  timestamps: true
}
);

// changed it to use users in mongodb instead of user
export const User = mongoose.model("User", userSchema, "users");