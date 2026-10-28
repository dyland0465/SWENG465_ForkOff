import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema({
  lobbyId: { type: Schema.Types.ObjectId, ref: "Lobby", required: true, index: true },
  memberId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  requestId: { type: String, required: true },
}, { timestamps: true, collection: "groupchat" });
messageSchema.index({ lobbyId: 1, memberId: 1, requestId: 1 }, {
  unique: true,
  partialFilterExpression: { requestId: { $type: "string" } },
});
messageSchema.index({ lobbyId: 1, _id: -1 });
export const GroupchatMessage = mongoose.model("GroupchatMessage", messageSchema);
