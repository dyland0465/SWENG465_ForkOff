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
      required: true,
      trim: true,
      maxlength: 120,
    },

    hostID: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    guestMembers: [
      {
        guestId: {
          type: String,
          required: true,
        },
        displayName: {
          type: String,
          required: true,
          trim: true,
          maxlength: 40,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting"
    },

    filters: {
      location: {
        type: String,
        trim: true,
        maxlength: 120,
      },

      dinnerAt: {
        type: Date,
      },

      maxDistance: {
        type: Number,
        min: 1,
        default: 10
      },

      minimumRating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
      },

      categories: {
        type: [String],
        default: []
      },

      openNow: {
        type: Boolean,
        default: false
      },

      priceLevels: {
        type: [String],
        default: [],
      },

      diningNeeds: {
        type: [String],
        default: [],
      }
    }
  },
  {
    timestamps: true,
    collection: "lobbies",
  }
);

export const Lobby = mongoose.model("Lobby", lobbySchema, "lobbies");




