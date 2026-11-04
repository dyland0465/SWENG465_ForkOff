import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import places from "../src/api_routes/placesRoutes";

test("place photos return provider URLs and attribution", async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GOOGLE_PLACES;
  process.env.GOOGLE_PLACES = "test-key";
  const app = express(); app.use(places);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const localFetch = oldFetch;
  try {
    globalThis.fetch = (async (url: any, options: any) => {
      if (String(url).includes("/media")) return new Response(JSON.stringify({ photoUri: "https://example.org/photo" }));
      assert.equal(options.headers["X-Goog-FieldMask"], "photos");
      return new Response(JSON.stringify({ photos: [{ name: "places/p/photos/a", authorAttributions: [{ displayName: "Author" }] }] }));
    }) as any;
    const response = await localFetch(`http://127.0.0.1:${(server.address() as any).port}/api/places/p/photos`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { placeId: "p", attribution: "Google Maps", photos: [{ url: "https://example.org/photo", authorAttributions: [{ displayName: "Author" }] }] });
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GOOGLE_PLACES; else process.env.GOOGLE_PLACES = oldKey;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
