import mongoose, { Schema } from "mongoose";

// Each document is a replaceable, revisioned projection of one round.
const roundSchema = new Schema({
  roundId: { type: String, required: true, unique: true },
  revision: { type: Number, required: true },
  startedAt: { type: Date, required: true, index: true },
  endedAt: Date,
  status: { type: String, enum: ["active", "completed", "abandoned"], required: true },
  participantCount: Number,
  source: String,
  restaurants: { type: [Schema.Types.Mixed], default: [] },
}, { collection: "analytics_rounds" });
roundSchema.index({ "restaurants.placeId": 1, startedAt: 1 });
export const AnalyticsRound = mongoose.model("AnalyticsRound", roundSchema);

const eventSchema = new Schema({
  key: { type: String, required: true, unique: true },
  placeId: { type: String, required: true },
  kind: { type: String, required: true },
  occurredAt: { type: Date, required: true, default: Date.now },
}, { collection: "analytics_events" });
eventSchema.index({ placeId: 1, occurredAt: 1, kind: 1 });
export const AnalyticsEvent = mongoose.model("AnalyticsEvent", eventSchema);

const metadataSchema = new Schema({ key: { type: String, unique: true }, startedAt: Date }, { collection: "analytics_metadata" });
export const AnalyticsMetadata = mongoose.model("AnalyticsMetadata", metadataSchema);
