import mongoose, { Schema } from "mongoose";

const voteSchema = new Schema ({

    lobbyID: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Lobby"
    },
    userID: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },

    restaurantID: {
        type: String,
        required: true
    },

    vote: {
        type: String,
        enum: ["yes", "no", "veto"],
        required: true
    }
},
{
    timestamps: true
});