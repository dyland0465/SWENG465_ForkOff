/**
 * partner-listings.test.ts
 *
 * Tests services/partnerListings.ts, which uses a partner's own information for
 * their restaurant when it comes up in a voting round:
 *  - only restaurants linked to an approved partner are changed
 *  - partnerDetails win over the sign-up form, which wins over Google
 *  - photo, rating, hours, distance and the Maps link always stay Google's
 *  - the partner's "$$" price becomes Google's price code so the card can show it
 *  - bad website links are dropped
 *  - if the database lookup fails, the round still gets Google's restaurants
 * The database is replaced with fakes, so this runs without MongoDB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { withPartnerListings } from "../src/services/partnerListings";
import { Restaurant } from "../src/db_models/restaurant";
import { User } from "../src/db_models/user";

const google = (id: string, name: string) => ({
  id, name, address: "Google address", category: "restaurant", priceLevel: "PRICE_LEVEL_EXPENSIVE",
  googleMapsUri: "https://maps.google.com/?cid=1", photoUrl: "/photo", rating: 4.2, distanceMiles: 1.5, hours: ["Mon: 9–5"],
});

test("partner restaurants in a round use the partner's own information", async () => {
  const original = { restaurants: Restaurant.find, users: User.find };
  const query = (result: () => unknown): any => ({ select: () => query(result), sort: () => query(result), lean: async () => result() });
  let userFilter: any;
  Restaurant.find = (() => query(() => [
    { _id: "r1", placeId: "place_signup_only", partnerDetails: {} },
    { _id: "r2", placeId: "place_both", partnerDetails: { restaurantName: "Copper Bowl Noodle Bar", phone: "(814) 555-0199", categories: ["Ramen"] } },
    { _id: "r3", placeId: "place_bad_link", partnerDetails: { website: "javascript:alert(1)" } },
    { _id: "r4", placeId: "place_no_partner", partnerDetails: { restaurantName: "Not shown" } },
  ])) as any;
  User.find = ((filter: any) => { userFilter = filter; return query(() => [
    { restaurantIds: ["r1"], requestedRestaurant: {
      name: "Harbor & Hearth", address: "1 Pier St", city: "Erie", state: "PA", postalCode: "16507", phone: "(814) 555-0100",
      website: "https://harbor.test", cuisine: "American", priceLevel: "$$", serviceOptions: ["Dine-in", "Takeout"],
    } },
    { restaurantIds: ["r2"], requestedRestaurant: { name: "Copper Bowl", address: "9 Main St", phone: "(814) 555-0000", cuisine: "Asian", priceLevel: "$" } },
    { restaurantIds: ["r3"], requestedRestaurant: {} },
  ]); }) as any;

  try {
    const round = [
      google("place_signup_only", "Harbor and Hearth Restaurant"),
      google("place_both", "Copper Bowl"),
      google("place_bad_link", "Bad Link Cafe"),
      google("place_no_partner", "Unclaimed Diner"),
      google("place_not_saved", "Brand New Spot"),
    ];
    const [signUp, both, badLink, noPartner, notSaved] = await withPartnerListings(round);

    assert.equal(userFilter.role, "partner");
    assert.equal(userFilter.partnerStatus, "approved", "pending or rejected partners don't count");

    // Sign-up info replaces Google's
    assert.equal(signUp.name, "Harbor & Hearth");
    assert.equal(signUp.address, "1 Pier St, Erie, PA 16507");
    assert.equal(signUp.category, "American");
    assert.equal(signUp.priceLevel, "PRICE_LEVEL_MODERATE");
    assert.deepEqual(signUp.partner, { verified: true, website: "https://harbor.test/", phone: "(814) 555-0100", serviceOptions: ["Dine-in", "Takeout"] });
    // Google-only fields are untouched
    assert.equal(signUp.rating, 4.2);
    assert.equal(signUp.photoUrl, "/photo");
    assert.equal(signUp.distanceMiles, 1.5);
    assert.deepEqual(signUp.hours, ["Mon: 9–5"]);
    assert.equal(signUp.googleMapsUri, "https://maps.google.com/?cid=1");
    assert.equal(signUp.id, "place_signup_only");

    // partnerDetails win over the sign-up form; the sign-up form fills the rest
    assert.equal(both.name, "Copper Bowl Noodle Bar");
    assert.equal(both.category, "Ramen");
    assert.equal(both.partner?.phone, "(814) 555-0199");
    assert.equal(both.address, "9 Main St", "street only when the sign-up had no city/state/ZIP");
    assert.equal(both.priceLevel, "PRICE_LEVEL_INEXPENSIVE");

    // Partner with nothing filled in: Google's values stay, but the badge shows
    assert.equal(badLink.name, "Bad Link Cafe");
    assert.equal(badLink.address, "Google address");
    assert.equal(badLink.priceLevel, "PRICE_LEVEL_EXPENSIVE");
    assert.deepEqual(badLink.partner, { verified: true }, "unsafe website is dropped");

    // No approved partner: exactly what Google returned
    assert.deepEqual(noPartner, round[3]);
    assert.deepEqual(notSaved, round[4]);

    // A failed lookup must not stop the round from starting.
    Restaurant.find = (() => { throw new Error("db down"); }) as any;
    const originalError = console.error; console.error = () => {};
    try { assert.deepEqual(await withPartnerListings(round), round); } finally { console.error = originalError; }

    assert.deepEqual(await withPartnerListings([]), []);
  } finally {
    Restaurant.find = original.restaurants;
    User.find = original.users;
  }
});