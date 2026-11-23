import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedMenuItems } from "../src/services/restaurantMenus";

test("extracts at most five unique dishes and prices from structured menu markup", () => {
  const names = ["Soup", "Soup", "Pasta", "Salad", "Risotto", "Pudding", "Cake"];
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "MenuSection",
    hasMenuItem: names.map(name => ({ "@type": "MenuItem", name, offers: { price: "12.50", priceCurrency: "USD" } })),
  })}</script>`;
  assert.deepEqual(publishedMenuItems(html), ["Soup", "Pasta", "Salad", "Risotto", "Pudding"].map(name => ({ name, price: 12.5 })));
});

test("extracts dishes from plain menu HTML and ignores unrelated headings", () => {
  assert.deepEqual(publishedMenuItems(`
    <h2>Reserve a table</h2>
    <ol class="menu-items-list"><li class="single-menu-item"><p class="menu-item-name">
      <span>Roast Chicken :</span> Description. <span class="price">28</span>
    </p></li></ol>
    <article class="rlhmm-item"><h4 class="rlhmm-item-name">Tomato Bisque <span>V</span></h4>
      <span class="rlhmm-item-price">10</span></article>
    <p><strong class="abril green-text">French Toast</strong> | Description <span>// 18</span></p>
  `), [
    { name: "Roast Chicken", price: 28 },
    { name: "Tomato Bisque", price: 10 },
    { name: "French Toast", price: 18 },
  ]);
});

test("keeps named dishes even when a price cannot be verified as USD", () => {
  assert.deepEqual(publishedMenuItems(`
    <article itemtype="https://schema.org/MenuItem">
      <span itemprop="name">Fish</span><meta itemprop="priceCurrency" content="EUR"><span itemprop="price">10</span>
    </article>
    <article itemtype="https://schema.org/MenuItem"><span itemprop="name">Bread</span></article>
  `), [{ name: "Fish" }, { name: "Bread" }]);
});
