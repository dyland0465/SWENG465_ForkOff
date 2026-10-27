import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { allowedOrigin, cookieToken, resolveIdentity, sessionEvents } from "./session";
import { Lobby } from "../db models/lobby";
import { changeLobby, findLobby, isOnline, lobbyEvents, memberFor, nextOnline, presence } from "./lobbyState";

export function attachRealtime(server: HttpServer, options: { graceMs?: number; tickMs?: number } = {}) {
  const grace = options.graceMs ?? 60_000;
  const started = Date.now();
  const offlineSince = new Map<string, number>();
  const io = new Server(server, {
    maxHttpBufferSize: 16_384,
    allowRequest(req, callback) {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      callback(null, allowedOrigin(req.headers.origin, req.headers.host, protocol));
    },
  });
  const room = (id: string) => `lobby:${id}`;
  const broadcast = (id: string) => io.to(room(id)).emit("lobby:changed", { lobbyId: id });
  const changed = (id: string) => { broadcast(id); void prune(id); };
  const deleted = (id: string) => {
    io.to(room(id)).emit("lobby:deleted", { lobbyId: id, message: "This lobby has been deleted." });
    io.in(room(id)).socketsLeave(room(id));
    presence.delete(id);
  };
  const message = (id: string, value: unknown) => io.to(room(id)).emit("chat:message", value);
  lobbyEvents.on("changed", changed); lobbyEvents.on("deleted", deleted); lobbyEvents.on("message", message);

  async function reconcile(id: string) {
    try {
      const lobby = await findLobby(id);
      const key = `${id}:${lobby.hostMemberId}`;
      if (lobby.hostMemberId && isOnline(id, lobby.hostMemberId)) { offlineSince.delete(key); return; }
      if (!offlineSince.has(key)) offlineSince.set(key, Math.max(started, Date.now()));
      if (lobby.hostMemberId && Date.now() - offlineSince.get(key)! < grace) return;
      if (!nextOnline(lobby)) return;
      await changeLobby(id, current => {
        if (current.hostMemberId !== lobby.hostMemberId || (current.hostMemberId && isOnline(id, current.hostMemberId))) return;
        const successor = nextOnline(current);
        if (successor) current.hostMemberId = successor.memberId;
      });
      offlineSince.delete(key);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) console.error("Leadership reconciliation failed:", error);
    }
  }
  async function prune(id: string) {
    try {
      const lobby = await findLobby(id);
      for (const socket of await io.in(room(id)).fetchSockets()) {
        if (!lobby.members.some(member => member.memberId === socket.data.memberId)) {
          io.sockets.sockets.get(socket.id)?.disconnect(true);
        }
      }
    } catch { /* Deleted lobbies have already had their room removed. */ }
  }
  io.use(async (socket, next) => {
    try {
      const identity = await resolveIdentity(socket.handshake.headers.cookie);
      if (!identity) return next(new Error("A valid session is required."));
      socket.data.identity = identity;
      next();
    } catch { next(new Error("Could not verify session.")); }
  });
  io.on("connection", socket => {
    let subscribing = false;
    socket.on("lobby:subscribe", async (key: unknown, ack: (value: unknown) => void) => {
      const reply = typeof ack === "function" ? ack : () => {};
      if (subscribing || socket.data.lobbyId) return reply({ error: "Already subscribed." });
      subscribing = true;
      try {
        if (typeof key !== "string") throw new Error("Invalid lobby.");
        const identity = await resolveIdentity(socket.handshake.headers.cookie);
        const lobby = await findLobby(key);
        const member = memberFor(lobby, identity);
        if (!socket.connected) return;
        const id = String(lobby._id);
        socket.data.lobbyId = id; socket.data.memberId = member.memberId;
        const members = presence.get(id) ?? new Map<string, Set<string>>();
        const tabs = members.get(member.memberId) ?? new Set<string>();
        tabs.add(socket.id); members.set(member.memberId, tabs); presence.set(id, members);
        await socket.join(room(id));
        if (lobby.hostMemberId === member.memberId) offlineSince.delete(`${id}:${member.memberId}`);
        await reconcile(id);
        await prune(id);
        broadcast(id);
        reply({ ok: true });
      } catch (error) { reply({ error: (error as Error).message }); }
      finally { subscribing = false; }
    });
    socket.on("disconnect", () => {
      const id = socket.data.lobbyId as string | undefined;
      if (!id) return;
      const members = presence.get(id);
      const tabs = members?.get(socket.data.memberId);
      tabs?.delete(socket.id);
      if (!tabs?.size) members?.delete(socket.data.memberId);
      if (!members?.size) presence.delete(id);
      broadcast(id);
      void reconcile(id);
    });
  });
  const revoked = (cookie: string) => {
    for (const socket of io.sockets.sockets.values()) {
      if (cookieToken(socket.handshake.headers.cookie) === cookieToken(cookie)) socket.disconnect(true);
    }
  };
  sessionEvents.on("revoked", revoked);
  const userRevoked = (userId: string) => {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.identity?.userId === userId) socket.disconnect(true);
    }
  };
  sessionEvents.on("userRevoked", userRevoked);
  let ticking = false;
  const timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      // Revalidate idle sockets as well as requests, including expired sessions.
      for (const socket of io.sockets.sockets.values()) {
        if (!await resolveIdentity(socket.handshake.headers.cookie)) socket.disconnect(true);
      }
      const lobbies = await Lobby.find({ revision: { $exists: true } }).select("_id").lean();
      await Promise.all(lobbies.map(lobby => reconcile(String(lobby._id))));
    } catch (error) { console.error("Live lobby maintenance failed:", error); }
    finally { ticking = false; }
  }, options.tickMs ?? 1000);
  timer.unref();
  const stop = () => {
    clearInterval(timer);
    lobbyEvents.off("changed", changed); lobbyEvents.off("deleted", deleted); lobbyEvents.off("message", message);
    sessionEvents.off("revoked", revoked);
    sessionEvents.off("userRevoked", userRevoked); presence.clear();
  };
  server.once("close", stop);
  return { io, stop };
}
