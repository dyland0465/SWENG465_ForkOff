import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema ({


    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true

    },

    message: {
        type: String,
        required: true
    }
},
{
    timestamps: true


});