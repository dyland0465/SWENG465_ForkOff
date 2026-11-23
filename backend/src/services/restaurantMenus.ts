import { Resolver } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { load } from "cheerio";
import robotsParser from "robots-parser";
import { Restaurant } from "../db_models/restaurant";

const crawler = "ForkOffMenuBot";
const blocked = new BlockList();
const reserved: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["168.63.129.16", 32], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
for (const [network, prefix] of reserved) blocked.addSubnet(network, prefix, "ipv4");
const resolver = new Resolver({ timeout: 2000, tries: 1 });
const maximumBytes = 2 * 1024 * 1024;

function siteUrl(value: string, base?: URL) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".") || isIP(url.hostname)) return null;
    url.hash = "";
    return url;
  } catch { return null; }
}

async function readPage(url: URL, signal: AbortSignal) {
  const addresses = await resolver.resolve4(url.hostname);
  if (!addresses.length || addresses.some(address => blocked.check(address, "ipv4"))) throw new Error("Website does not resolve to public addresses.");
  // Connect to the checked address while validating TLS against the original hostname.
  return new Promise<{ status: number; body: string; redirect?: string }>((resolve, reject) => {
    const outgoing = request({
      hostname: addresses[0], servername: url.hostname, path: url.pathname + url.search,
      agent: false, signal, headers: { Host: url.host, "User-Agent": crawler, Accept: "text/html, text/plain" },
    }, response => {
      const status = response.statusCode ?? 500;
      const type = response.headers["content-type"]?.split(";")[0]?.trim();
      if (status !== 200 || !["text/html", "application/xhtml+xml", "text/plain"].includes(type ?? "")) {
        response.destroy();
        resolve({ status, body: "", redirect: response.headers.location });
        return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maximumBytes) response.destroy(new Error("Website response exceeded the menu import limit."));
        else chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}

type MenuItem = { name: string; price?: number };

export function publishedMenuItems(html: string): MenuItem[] {
  const page = load(html);
  const items: MenuItem[] = [];
  const names = new Set<string>();
  function add(name: unknown, price: unknown, currency?: unknown) {
    if (items.length >= 5 || typeof name !== "string") return;
    const title = name.trim().replace(/\s+/g, " ");
    if (!title || title.length > 100 || names.has(title.toLowerCase())) return;
    names.add(title.toLowerCase());
    const amount = typeof price === "string" || typeof price === "number" ? String(price).trim() : "";
    const dollars = (!currency || currency === "USD") && /^\$?\d{1,4}(\.\d{1,2})?$/.test(amount);
    items.push({ name: title, ...(dollars ? { price: Number(amount.replace(/^\$/, "")) } : {}) });
  }

  for (const script of page('script[type="application/ld+json"]').toArray()) {
    let data: unknown;
    try { data = JSON.parse(page(script).text()); } catch { continue; }
    const pending = [data];
    while (pending.length && items.length < 5) {
      const node = pending.pop();
      if (Array.isArray(node)) { for (let index = node.length - 1; index >= 0; index--) pending.push(node[index]); continue; }
      if (!node || typeof node !== "object") continue;
      const properties = node as Record<string, unknown>;
      const types = [properties["@type"]].flat();
      if (types.some(type => typeof type === "string" && /^(https?:\/\/schema\.org\/)?MenuItem$/.test(type))) {
        const [offer] = [properties.offers].flat() as (Record<string, unknown> | undefined)[];
        add(properties.name, offer?.price, offer?.priceCurrency);
      }
      for (const [key, value] of Object.entries(properties).reverse()) if (key !== "@context") pending.push(value);
    }
  }
  for (const item of page('[itemtype$="/MenuItem"]').toArray()) {
    const value = (name: string) => {
      const field = page(item).find(`[itemprop="${name}"]`).first();
      return field.attr("content") ?? field.text();
    };
    add(value("name"), value("price"), value("priceCurrency"));
  }
  // Some restaurant sites publish menus as HTML without Schema.org annotations.
  const menuRows = ".menu-items-list .single-menu-item, .rlhmm-item, p:has(> strong.abril.green-text), " +
    '[data-hook="item.root"], [class*="MealCard_main__"]';
  for (const item of page(menuRows).toArray()) {
    if (items.length >= 5) break;
    const row = page(item);
    if (row.is(".single-menu-item")) {
      const name = row.find(".menu-item-name > span:not(.price)").first().text().trim().replace(/:\s*$/, "");
      add(name, row.find(".price").first().text());
    } else if (row.is(".rlhmm-item")) {
      const heading = row.find(".rlhmm-item-name").first().clone();
      heading.children().remove();
      add(heading.text(), row.find(".rlhmm-item-price").first().text());
    } else if (row.is('[data-hook="item.root"]')) {
      add(row.find('[data-hook="item.name"]').first().text(), row.find('[data-hook="item.price-container"]').first().text());
    } else if (row.is('[class*="MealCard_main__"]')) {
      add(row.find('[class*="MealCard_mealName__"]').first().text(), row.find('[class*="MealCard_mealPriceAndAction__"]').first().text());
    } else {
      const price = row.children("span").last().text().trim().match(/^\/\/\s*(\d+(?:\.\d{1,2})?)$/);
      if (price) add(row.children("strong").first().text(), price[1]);
    }
  }
  return items;
}

async function findPublishedMenu(website: string) {
  const home = siteUrl(website.replace(/^http:\/\//i, "https://"));
  if (!home) return null;
  const origin = home.origin;
  const signal = AbortSignal.timeout(12000);

  async function open(start: URL, allowed: (url: URL) => boolean) {
    let url: URL | null = start;
    for (let redirects = 0; url && redirects < 3; redirects++) {
      if (url.origin !== origin || !allowed(url)) return null;
      const response = await readPage(url, signal);
      if (!response.redirect) return { url, ...response };
      url = response.redirect && [301, 302, 303, 307, 308].includes(response.status) ? siteUrl(response.redirect, url) : null;
    }
    return null;
  }

  const robotsUrl = new URL("/robots.txt", home);
  const rules = await open(robotsUrl, () => true);
  if (!rules || (rules.status !== 200 && rules.status !== 404)) return null;
  const robots = robotsParser(robotsUrl.href, rules.body);
  const allowed = (url: URL) => robots.isAllowed(url.href, crawler) === true;
  const landing = await open(home, allowed);
  if (!landing || landing.status !== 200) return null;
  const pages = load(landing.body);
  const candidates = new Map<string, URL>();
  for (const element of pages('a[href]').toArray()) {
    const link = pages(element);
    const url = siteUrl(link.attr("href") ?? "", landing.url);
    if (url && url.href !== landing.url.href && url.origin === origin && /\bmenus?\b/i.test(link.text().trim())) candidates.set(url.href, url);
  }
  const fallback = new URL("/menu", landing.url);
  candidates.set(fallback.href, fallback);
  const found = publishedMenuItems(landing.body);
  if (found.length) return { sourceUrl: landing.url.href, items: found };
  for (const candidate of [...candidates.values()].slice(0, 3)) {
    const page = await open(candidate, allowed);
    const items = page?.status === 200 ? publishedMenuItems(page.body) : [];
    if (page && items.length) return { sourceUrl: page.url.href, items };
  }
  return null;
}

const inFlight = new Map<string, Promise<void>>();

export function queueRestaurantMenuImports(restaurants: { id: string; websiteUri?: string }[]) {
  for (const { id, websiteUri } of restaurants) {
    if (!websiteUri || inFlight.has(id) || inFlight.size >= 10) continue;
    const job = importMenu(id, websiteUri).catch(() => {}).finally(() => inFlight.delete(id));
    inFlight.set(id, job);
  }
}

async function importMenu(placeId: string, website: string) {
  const startedAt = new Date();
  const retryAfter = new Date(startedAt.getTime() - 24 * 60 * 60 * 1000);
  const claim = await Restaurant.updateOne({ placeId, menu: null, $or: [
    { menuImportAttemptedAt: { $exists: false } }, { menuImportAttemptedAt: { $lte: retryAfter } },
  ] }, { $set: { menuImportAttemptedAt: startedAt } });
  if (!claim.modifiedCount) return;
  const found = await findPublishedMenu(website);
  if (!found) return;
  await Restaurant.updateOne({ placeId, menu: null, menuImportAttemptedAt: startedAt }, { $set: { menu: {
    sourceUrl: found.sourceUrl, retrievedAt: new Date().toISOString(),
    categories: [{ name: "Highlights", items: found.items }],
  } } });
}
