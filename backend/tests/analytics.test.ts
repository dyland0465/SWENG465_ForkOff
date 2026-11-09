import { test } from "node:test";
import assert from "node:assert/strict";
import { drainTelemetry, freezeCompleted, roundProjection, roundResults } from "../src/services/analytics";
import { Lobby } from "../src/db_models/lobby";
import { AnalyticsRound } from "../src/db_models/telemetry";

test("completed results freeze membership, retain ties and do not count vetoed places as ranked", () => {
  const round = { id: "round", startedAt: "2026-01-01T00:00:00Z", restaurants: [{ id: "a" }, { id: "b" }, { id: "c" }],
    participants: ["one", "two"], decisions: { one: { a: "yes", b: "yes", c: "veto" }, two: { a: "no", b: "no", c: "yes" } } };
  const members = [{ memberId: "one" }, { memberId: "two" }];
  freezeCompleted(round, members, new Date("2026-01-02T00:00:00Z"));
  assert.deepEqual(roundResults(round, [members[0]]).map(r => r.restaurant.id), ["a", "b", "c"]);
  const projection = roundProjection(round, [members[0]], 2, "discovery", true, new Date("2026-01-03T00:00:00Z"))!;
  assert.equal(projection.status, "completed");
  assert.equal(projection.participantCount, 2);
  assert.deepEqual(projection.restaurants.map(r => [r.rank, r.tied, r.vetoed]), [[1, true, false], [2, true, false], [null, false, true]]);
});

test("outbox retries discard stale revisions and delete a tombstone only after acknowledgement", async () => {
  const originals = { find: Lobby.findById, update: Lobby.updateOne, remove: Lobby.deleteOne, project: AnalyticsRound.updateOne, exists: AnalyticsRound.exists };
  const queue: any[] = [{ roundId: "r", revision: 2 }, { roundId: "r", revision: 1 }];
  let current = 0, removed = false;
  Lobby.findById = (() => ({ select: () => ({ lean: async () => ({ telemetryOutbox: [...queue], telemetryDeleted: true }) }) })) as any;
  Lobby.updateOne = (async (_query: any, update: any) => { const item = update.$pull.telemetryOutbox; const index = queue.findIndex(x => x.roundId === item.roundId && x.revision === item.revision); if (index >= 0) queue.splice(index, 1); }) as any;
  Lobby.deleteOne = (async () => { assert.equal(queue.length, 0); removed = true; }) as any;
  AnalyticsRound.updateOne = (async (_query: any, update: any) => { if (update.$set.revision <= current) throw Object.assign(new Error("duplicate"), { code: 11000 }); current = update.$set.revision; }) as any;
  AnalyticsRound.exists = (async () => current >= 1) as any;
  try { await drainTelemetry("lobby"); assert.equal(current, 2); assert.equal(removed, true); }
  finally { Lobby.findById = originals.find; Lobby.updateOne = originals.update; Lobby.deleteOne = originals.remove; AnalyticsRound.updateOne = originals.project; AnalyticsRound.exists = originals.exists; }
});

test("incomplete rounds become abandoned and old rounds are not treated as new telemetry", () => {
  const round = { id: "round", startedAt: "2026-01-01T00:00:00Z", restaurants: [{ id: "a" }], participants: ["one", "two"], decisions: { one: { a: "yes" } } };
  const members = [{ memberId: "one" }, { memberId: "two" }];
  freezeCompleted(round, members, new Date());
  assert.equal(roundProjection(round, members, 3, "collection", true, new Date())?.status, "abandoned");
  assert.equal(roundProjection({ ...round, startedAt: undefined }, members, 3, "collection", true, new Date()), null);
  freezeCompleted(round, [members[0]], new Date());
  assert.equal(roundProjection(round, [members[0]], 4, "collection", false, new Date())?.status, "completed");
});
