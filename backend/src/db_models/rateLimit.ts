import mongoose, { Schema } from "mongoose";

// One shared counter per client, policy and fixed time window. TTL cleanup is
// asynchronous; the window identifier prevents stale counters from being reused.
const schema = new Schema({ _id: String, count: { type: Number, required: true }, expiresAt: { type: Date, required: true, index: { expires: 0 } } }, { versionKey: false });
export const RateLimit = mongoose.model("RateLimit", schema, "api_rate_limits");
