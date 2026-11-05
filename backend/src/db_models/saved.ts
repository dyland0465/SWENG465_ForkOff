import mongoose, { Schema } from "mongoose";
const favoriteSchema = new Schema({ userId: { type: Schema.Types.ObjectId, required: true }, placeId: { type: String, required: true, maxlength: 300 } }, { timestamps: true });
favoriteSchema.index({ userId: 1, placeId: 1 }, { unique: true });
export const Favorite = mongoose.model("Favorite", favoriteSchema);
const collectionSchema = new Schema({ userId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true, trim: true, maxlength: 80 }, placeIds: { type: [String], default: [] } }, { timestamps: true });
export const RestaurantCollection = mongoose.model("RestaurantCollection", collectionSchema);
const groupSchema = new Schema({ ownerId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true, trim: true, maxlength: 80 }, members: [{ _id: false, userId: { type: Schema.Types.ObjectId, required: true }, displayName: { type: String, required: true, maxlength: 40 } }] }, { timestamps: true });
export const SavedGroup = mongoose.model("SavedGroup", groupSchema);
const invitationSchema = new Schema({ groupId: { type: Schema.Types.ObjectId, required: true }, lobbyId: { type: Schema.Types.ObjectId, required: true }, recipientId: { type: Schema.Types.ObjectId, required: true, index: true }, senderId: { type: Schema.Types.ObjectId, required: true }, status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" }, expiresAt: { type: Date, required: true, index: { expires: 0 } } }, { timestamps: true });
invitationSchema.index({ groupId: 1, lobbyId: 1, recipientId: 1 }, { unique: true });
export const GroupInvitation = mongoose.model("GroupInvitation", invitationSchema);

const collectionShareSchema = new Schema({ ownerId: { type: Schema.Types.ObjectId, required: true }, collectionId: { type: Schema.Types.ObjectId, required: true }, tokenHash: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true, index: { expires: 0 } } }, { timestamps: true });
export const CollectionShare = mongoose.model("CollectionShare", collectionShareSchema);
