import mongoose, { Schema } from "mongoose";



const lobbySchema = new Schema({
    name: { type: String, required: true, trim: true },
    numPlayers: { type: Number, required: true },
    restaurant: { type: String, required: true, trim: true },
    LobbyId: { type: Schema.Types.ObjectId, required: false }
});



