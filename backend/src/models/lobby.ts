import mongoose, { Schema } from "mongoose";

const lobbySchema = new Schema(
  {
    lobbyCode: {
      type: String,
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true
    },

    hostID: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting"
    },

    filters: {
      maxDistance: {
        type: Number,
        default: 10
      },

      minimumRating: {
        type: Number,
        default: 0
      },

      categories: {
        type: [String],
        default: []
      },

      openNow: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
);

export const Lobby = mongoose.model("Lobby", lobbySchema);




