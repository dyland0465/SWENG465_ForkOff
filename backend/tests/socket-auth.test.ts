import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { io as client } from "socket.io-client";
import { attachRealtime } from "../src/services/realtime";
import { Session } from "../src/db_models/session";
import { Lobby } from "../src/db_models/lobby";
import { sessionEvents } from "../src/services/session";

test("realtime requires a valid JWT and lobby membership and disconnects revoked sessions", async () => {
  const secret = "test-only-secret-at-least-32-bytes-long"; process.env.JWT_SECRET = secret;
  const old = { session: Session.findOne, lobby: Lobby.findOne, exists: Lobby.exists };
  const token = (subject: string) => jwt.sign({}, secret, { algorithm: "HS256", issuer: "forkoff", audience: "forkoff-web", subject, jwtid: subject, expiresIn: 60 });
  const memberToken = token("guest:member"), strangerToken = token("guest:stranger");
  const hash = (t: string) => createHash("sha256").update(t).digest("hex");
  const sessions = new Map([[hash(memberToken), { identityKey: "guest:member" }], [hash(strangerToken), { identityKey: "guest:stranger" }]]);
  Session.findOne = ((filter: any) => ({ lean: async () => sessions.get(filter.tokenHash) ?? null })) as any;
  const lobby = { _id: "507f1f77bcf86cd799439011", revision: 0, hostMemberId: "m1", members: [{ memberId: "m1", identityKey: "guest:member", joinOrder: 0 }] };
  Lobby.findOne = (async () => lobby) as any; Lobby.exists = (async () => ({ _id: lobby._id })) as any;
  const server = createServer(); const live = attachRealtime(server, { tickMs: 60000 });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const sockets: ReturnType<typeof client>[] = [];
  const connect = (cookie: string) => { const s = client(url, { transports: ["websocket"], extraHeaders: { cookie }, reconnection: false }); sockets.push(s); return s; };
  try {
    const invalid = connect("forkoff_session=invalid");
    await new Promise<void>((resolve, reject) => { invalid.once("connect_error", () => resolve()); invalid.once("connect", () => reject(new Error("invalid token connected"))); });
    const stranger = connect(`forkoff_session=${strangerToken}`); await new Promise<void>(r => stranger.once("connect", r));
    const rejected: any = await stranger.timeout(2000).emitWithAck("lobby:subscribe", "ABC123");
    assert.ok(rejected.error);
    const member = connect(`forkoff_session=${memberToken}`); await new Promise<void>(r => member.once("connect", r));
    const joined: any = await member.timeout(2000).emitWithAck("lobby:subscribe", "ABC123"); assert.equal(joined.ok, true);
    const disconnected = new Promise<void>(r => member.once("disconnect", () => r()));
    sessions.delete(hash(memberToken)); sessionEvents.emit("revoked", `forkoff_session=${memberToken}`);
    await disconnected;
  } finally {
    for (const s of sockets) s.disconnect(); live.stop();
    Session.findOne = old.session; Lobby.findOne = old.lobby; Lobby.exists = old.exists; delete process.env.JWT_SECRET;
    await new Promise<void>((r, j) => server.close(e => e ? j(e) : r()));
  }
});
