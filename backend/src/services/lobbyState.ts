import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import { Lobby } from "../db_models/lobby";
import { GroupchatMessage } from "../db_models/groupchat";
import { Vote } from "../db_models/vote";
import type { Identity } from "./session";
import { freezeCompleted, roundProjection, scheduleTelemetryDrain } from "./analytics";

// HttpError now lives in utils/errors.ts; re-exported here so existing imports keep working.
import { HttpError } from "../utils/errors";
export { HttpError };
export type Member = { memberId: string; identityKey: string; userId?: mongoose.Types.ObjectId; type: "user" | "guest"; displayName: string; joinOrder: number; joinedAt: Date };
export type LobbyDocument = mongoose.HydratedDocument<{
  lobbyCode: string; name: string; hostMemberId: string | null; nextJoinOrder: number; revision: number;
  members: Member[]; status: "waiting" | "playing" | "finished";
  filters: { location?: string; dinnerAt?: Date; maxDistance?: number; minimumRating?: number; categories?: string[]; openNow?: boolean; priceLevels?: string[]; diningNeeds?: string[] };
  collectionSource?: { name: string; placeIds: string[] } | null;
  createdAt: Date; updatedAt: Date;
  round?: { id: string; startedAt?: string; completedAt?: string; completedParticipants?: string[]; warnings?: string[]; restaurants: { id: string; name: string; address: string | null; category: string | null; googleMapsUri: string | null; photoUrl: string | null; photoAuthors: { displayName: string; uri?: string }[]; rating?: number | null; ratingCount?: number | null; priceLevel?: string | null; distanceMiles?: number | null; hours?: string[]; timeZone?: string | null }[]; participants: string[]; decisions: Record<string, Record<string, string>> } | null;
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
  const lobby = await Lobby.findOne({ ...filter, revision: { $exists: true }, telemetryDeleted: { $ne: true } });
  if (!lobby) {
    if (await Lobby.exists({ ...filter, telemetryDeleted: { $ne: true } })) throw new HttpError(409, "This old lobby must be removed using the lobby cleanup command.");
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
    collectionSource: lobby.collectionSource ? { name: lobby.collectionSource.name, count: lobby.collectionSource.placeIds.length } : null,
    hostMemberId: lobby.hostMemberId, revision: lobby.revision, filters: lobby.filters, roundId: lobby.round?.id ?? null,
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
    const previousRound = lobby.round ? JSON.parse(JSON.stringify(lobby.round)) as NonNullable<LobbyDocument["round"]> : null;
    const previousMembers = [...lobby.members];
    const action = change(lobby);
    const now = new Date();
    if (action !== "delete") freezeCompleted(lobby.round, lobby.members, now);
    const ending = action === "delete" || (previousRound && previousRound.id !== lobby.round?.id);
    const outgoing = ending && previousRound ? roundProjection(previousRound, previousMembers, revision + 1, lobby.collectionSource ? "collection" : "discovery", true, now) : null;
    const current = action !== "delete" && lobby.round ? roundProjection(lobby.round, lobby.members, revision + 1, lobby.collectionSource ? "collection" : "discovery", false, now) : null;
    const events = [outgoing, current].filter(Boolean);
    const result = await Lobby.findOneAndUpdate({ _id: lobby._id, revision, telemetryDeleted: { $ne: true } }, { $set: {
      members: lobby.members, hostMemberId: lobby.hostMemberId, nextJoinOrder: lobby.nextJoinOrder,
      name: lobby.name, status: lobby.status, filters: lobby.filters, round: lobby.round,
      ...(action === "delete" ? { telemetryDeleted: true } : {}),
    }, $inc: { revision: 1 }, ...(events.length ? { $push: { telemetryOutbox: { $each: events } } } : {}) }, { returnDocument: "after", runValidators: true });
    if (!result) continue;
    if (events.length || action === "delete") scheduleTelemetryDrain(String(lobby._id));
    if (action === "delete") {
      await deleteRelated(String(lobby._id));
      lobbyEvents.emit("deleted", String(lobby._id));
      return null;
    }
    lobbyEvents.emit("changed", String(lobby._id));
    return result as unknown as LobbyDocument;
  }
  throw new HttpError(409, "Lobby changed repeatedly. Please retry.");
}
export async function deleteRelated(lobbyId: string) {
  await Promise.all([GroupchatMessage.deleteMany({ lobbyId }), Vote.deleteMany({ lobbyID: lobbyId })]);
}
