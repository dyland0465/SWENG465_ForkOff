import { ObjectId } from "mongodb";



export default class Lobby {
  constructor(private name: string, private numPlayers: number, private restaurant: string private LobbyId?: ObjectId) { }

}
