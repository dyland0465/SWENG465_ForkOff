import { AnalyticsEvent, AnalyticsMetadata, AnalyticsRound } from "../db_models/telemetry";
import { Lobby } from "../db_models/lobby";

type Round = { id: string; startedAt?: string | Date; completedAt?: string | Date; completedParticipants?: string[]; restaurants: { id: string }[]; participants: string[]; decisions: Record<string, Record<string, string>> };
type Member = { memberId: string };

export function activeParticipants(round: Round, members: Member[]) {
  return round.completedParticipants ?? round.participants.filter(id => members.some(member => member.memberId === id));
}

export function roundResults(round: Round, members: Member[]) {
  const participants = activeParticipants(round, members);
  return round.restaurants.map((restaurant, index) => {
    const choices = participants.map(id => round.decisions[id]?.[restaurant.id]);
    return { restaurant, index, yes: choices.filter(x => x === "yes").length, no: choices.filter(x => x === "no").length,
      veto: choices.filter(x => x === "veto").length, skip: choices.filter(x => x === "skip").length };
  }).sort((a, b) => Number(a.veto > 0) - Number(b.veto > 0) || b.yes - a.yes || a.index - b.index);
}

export function freezeCompleted(round: Round | null | undefined, members: Member[], now: Date) {
  if (!round || round.completedAt) return;
  const participants = activeParticipants(round, members);
  if (participants.length && participants.every(id => round.restaurants.every(r => Boolean(round.decisions[id]?.[r.id])))) {
    round.completedParticipants = participants;
    round.completedAt = now.toISOString();
  }
}

export function roundProjection(round: Round, members: Member[], revision: number, source: string, ending: boolean, now: Date) {
  if (!round.startedAt) return null; // Older rounds predate reliable collection.
  const complete = Boolean(round.completedAt);
  const results = roundResults(round, members);
  const eligible = results.filter(row => !row.veto);
  return {
    roundId: round.id, revision, startedAt: round.startedAt, endedAt: complete ? round.completedAt : ending ? now : null,
    status: complete ? "completed" : ending ? "abandoned" : "active", source,
    participantCount: activeParticipants(round, members).length,
    restaurants: results.map(row => {
      const rank = eligible.indexOf(row) + 1;
      return { placeId: row.restaurant.id, yes: row.yes, no: row.no,
        veto: row.veto, skip: row.skip,
        rank: complete && rank ? rank : null,
        tied: complete && rank > 0 && eligible.filter(other => other.yes === row.yes).length > 1,
        vetoed: complete && row.veto > 0 };
    }),
  };
}

export async function initializeAnalytics() {
  await Promise.all([AnalyticsRound.init(), AnalyticsEvent.init(), AnalyticsMetadata.init()]);
  await AnalyticsMetadata.updateOne({ key: "collection" }, { $setOnInsert: { startedAt: new Date() } }, { upsert: true });
}

export async function drainTelemetry(id: string) {
  const lobby = await Lobby.findById(id).select("telemetryOutbox telemetryDeleted").lean();
  if (!lobby) return;
  for (const item of (lobby.telemetryOutbox ?? []) as any[]) {
    const { roundId, revision } = item;
    try {
      await AnalyticsRound.updateOne({ roundId, revision: { $lt: revision } }, { $set: item }, { upsert: true });
    } catch (error) {
      // A later revision may already have won a concurrent drain.
      if ((error as { code?: number }).code !== 11000 || !await AnalyticsRound.exists({ roundId, revision: { $gte: revision } })) throw error;
    }
    await Lobby.updateOne({ _id: id }, { $pull: { telemetryOutbox: { roundId, revision } } });
  }
  if (lobby.telemetryDeleted) await Lobby.deleteOne({ _id: id, telemetryDeleted: true, "telemetryOutbox.0": { $exists: false } });
}

export function scheduleTelemetryDrain(id: string) {
  void drainTelemetry(id).catch(error => console.error("Analytics outbox drain failed:", error));
}

export async function drainPendingTelemetry() {
  const lobbies = await Lobby.find({ $or: [{ "telemetryOutbox.0": { $exists: true } }, { telemetryDeleted: true }] }).select("_id").lean();
  for (const lobby of lobbies) {
    try { await drainTelemetry(String(lobby._id)); } catch (error) { console.error("Analytics outbox retry failed:", error); }
  }
}
