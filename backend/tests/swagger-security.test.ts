import { test } from "node:test";
import assert from "node:assert/strict";
import spec from "../src/config/swagger";

test("OpenAPI advertises the production domain and route security", () => {
  const doc: any = spec;
  assert.ok(doc.servers.some((s: any) => s.url === "https://forkoff.duckdns.org"));
  assert.ok(doc.servers.some((s: any) => s.url === "http://localhost:3000"));
  assert.equal(doc.components.securitySchemes.lobbySession.in, "cookie");
  assert.equal(doc.components.securitySchemes.lobbySession.name, "forkoff_session");
  for (const [path, method] of [["/api/users/{id}", "get"], ["/api/users/{id}", "patch"], ["/api/users/{id}", "delete"], ["/api/restaurants/{id}", "delete"], ["/api/admin/partners", "get"], ["/api/lobbies/{id}/round/vote", "put"]]) {
    const op = doc.paths[path][method]; assert.deepEqual(op.security, [{ lobbySession: [] }]); assert.ok(op.responses["401"]); assert.ok(op.responses["403"]);
  }
  assert.equal(doc.paths["/api/restaurants/import"].post.security, undefined);
  assert.ok(doc.paths["/api/restaurants/import"].post.responses["429"]);
  assert.equal(doc.paths["/api/lobbies/{id}/votes"].post.deprecated, true);
});
