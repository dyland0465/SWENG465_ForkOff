import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema ({

    LobbyId: {
        type: Schema.Types.ObjectId,
        ref: "Lobby",
        required: true
    },

    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true

    },



    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    }
},
{
    timestamps: true


});

export const GroupchatMessage = mongoose.model("GroupchatMessage", messageSchema, "groupchat");
