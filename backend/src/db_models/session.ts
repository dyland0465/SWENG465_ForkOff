import mongoose, { Schema } from "mongoose";

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  identityKey: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});
export const Session = mongoose.model("Session", sessionSchema);
