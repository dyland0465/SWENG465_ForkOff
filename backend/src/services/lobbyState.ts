import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import { Lobby } from "../models/lobby";
import { GroupchatMessage } from "../models/groupchat";
import { Vote } from "../models/vote";
import type { Identity } from "./session";

// HttpError now lives in utils/errors.ts; re-exported here so existing imports keep working.
import { HttpError } from "../utils/errors";
export { HttpError };
export type Member = { memberId: string; identityKey: string; userId?: mongoose.Types.ObjectId; type: "user" | "guest"; displayName: string; joinOrder: number; joinedAt: Date };
export type LobbyDocument = mongoose.HydratedDocument<{
  lobbyCode: string; name: string; hostMemberId: string | null; nextJoinOrder: number; revision: number;
  members: Member[]; status: "waiting" | "playing" | "finished";
  filters: { location?: string; dinnerAt?: Date; maxDistance?: number; minimumRating?: number; categories?: string[]; openNow?: boolean; priceLevels?: string[]; diningNeeds?: string[] };
  createdAt: Date; updatedAt: Date;
}>;
export const lobbyEvents = new EventEmitter();
export const presence = new Map<string, Map<string, Set<string>>>();
export const isOnline = (lobbyId: string, memberId: string) => Boolean(presence.get(lobbyId)?.get(memberId)?.size);
export function nextOnline(lobby: LobbyDocument) {
  return [...lobby.members].sort((a, b) => a.joinOrder - b.joinOrder).find(member => isOnline(String(lobby._id), member.memberId));
}
export function lobbyFilter(key: string) {
  return mongoose.isValidObjectId(key) ? { _id: key } : { lobbyCode: key.trim().toUpperCase() };
}
export async function findLobby(key: string): Promise<LobbyDocument> {
  const filter = lobbyFilter(key);
  const lobby = await Lobby.findOne({ ...filter, revision: { $exists: true } });
  if (!lobby) {
    if (await Lobby.exists(filter)) throw new HttpError(409, "This old lobby must be removed using the lobby cleanup command.");
    throw new HttpError(404, "Lobby not found.");
  }
  return lobby as unknown as LobbyDocument;
}
export function memberFor(lobby: LobbyDocument, identity?: Identity) {
  if (!identity) throw new HttpError(401, "Join or log in to continue.");
  const member = lobby.members.find(member => member.identityKey === identity.key);
  if (!member) throw new HttpError(403, "Join this lobby with your current identity first.");
  return member;
}
export function requireHost(lobby: LobbyDocument, identity?: Identity) {
  const member = memberFor(lobby, identity);
  if (member.memberId !== lobby.hostMemberId) throw new HttpError(403, "Only the host can change this lobby.");
  return member;
}
export function serializeLobby(lobby: LobbyDocument, identity?: Identity) {
  const own = lobby.members.find(member => member.identityKey === identity?.key);
  return {
    id: String(lobby._id), lobbyCode: lobby.lobbyCode, name: lobby.name, status: lobby.status,
    hostMemberId: lobby.hostMemberId, revision: lobby.revision, filters: lobby.filters,
    members: lobby.members.map(({ memberId, userId, type, displayName, joinOrder, joinedAt }) => ({
      memberId, userId, type, displayName, joinOrder, joinedAt, online: isOnline(String(lobby._id), memberId),
    })),
    selfMemberId: own?.memberId ?? null, isHost: Boolean(own && own.memberId === lobby.hostMemberId),
  };
}

// Every membership/settings write shares a revision, preventing lost updates and
// ensuring host permissions are checked again after a concurrent succession.
export async function changeLobby(key: string, change: (lobby: LobbyDocument) => void | "delete") {
  for (let attempt = 0; attempt < 10; attempt++) {
    const lobby = await findLobby(key);
    const revision = lobby.revision;
    const action = change(lobby);
    if (action === "delete") {
      const deleted = await Lobby.deleteOne({ _id: lobby._id, revision });
      if (!deleted.deletedCount) continue;
      await deleteRelated(String(lobby._id));
      lobbyEvents.emit("deleted", String(lobby._id));
      return null;
    }
    const result = await Lobby.findOneAndUpdate({ _id: lobby._id, revision }, { $set: {
      members: lobby.members, hostMemberId: lobby.hostMemberId, nextJoinOrder: lobby.nextJoinOrder,
      name: lobby.name, status: lobby.status, filters: lobby.filters,
    }, $inc: { revision: 1 } }, { returnDocument: "after", runValidators: true });
    if (!result) continue;
    lobbyEvents.emit("changed", String(lobby._id));
    return result as unknown as LobbyDocument;
  }
  throw new HttpError(409, "Lobby changed repeatedly. Please retry.");
}
export async function deleteRelated(lobbyId: string) {
  await Promise.all([GroupchatMessage.deleteMany({ lobbyId }), Vote.deleteMany({ lobbyID: lobbyId })]);
}
