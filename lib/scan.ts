import * as cheerio from "cheerio";
import { parseRobots, isAllowed } from "./robots";
import type { Check, Category, ScanResult, BotStatus } from "./types";

const UA =
  "AnswerReadyBot/1.0 (+https://answerready.io/bot; AI-search readiness audit)";
// Plenty of corporate sites take 10s+ to answer a cold request. Anything
// slower than this is a finding in itself, not a reason to give up early.
const TIMEOUT_MS = 20_000;

/** Crawlers that decide whether a brand can appear in AI answers at all. */
const AI_BOTS: { ua: string; label: string; weight: number }[] = [
  { ua: "OAI-SearchBot", label: "ChatGPT Search", weight: 3 },
  { ua: "ChatGPT-User", label: "ChatGPT (live browsing)", weight: 3 },
  { ua: "GPTBot", label: "OpenAI training crawler", weight: 2 },
  { ua: "PerplexityBot", label: "Perplexity", weight: 3 },
  { ua: "Perplexity-User", label: "Perplexity (live browsing)", weight: 2 },
  { ua: "Google-Extended", label: "Google AI Overviews / Gemini", weight: 3 },
  { ua: "Claude-User", label: "Claude (live browsing)", weight: 2 },
  { ua: "ClaudeBot", label: "Anthropic crawler", weight: 2 },
  { ua: "Applebot-Extended", label: "Apple Intelligence", weight: 1 },
  { ua: "meta-externalagent", label: "Meta AI", weight: 1 },
  { ua: "CCBot", label: "Common Crawl (feeds many models)", weight: 1 },
];

async function get(
  url: string
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,text/plain,*/*" },
    });
    const text = res.ok ? await res.text() : "";
    return { ok: res.ok, status: res.status, text, finalUrl: res.url || url };
  } catch {
    return { ok: false, status: 0, text: "", finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Plenty of hosts answer on only one of the apex and the www subdomain, and
 * visitors type whichever they remember. Try the other one before declaring
 * a site unreachable.
 */
async function getPage(url: string) {
  const first = await get(url);
  if (first.ok) return first;

  const u = new URL(url);
  u.hostname = u.hostname.startsWith("www.")
    ? u.hostname.slice(4)
    : "www." + u.hostname;
  const second = await get(u.toString());
  return second.ok ? second : first;
}

function check(
  id: string,
  label: string,
  max: number,
  earned: number,
  detail: string,
  fix?: string
): Check {
  const ratio = earned / max;
  const status = ratio >= 0.99 ? "pass" : ratio >= 0.5 ? "warn" : "fail";
  return { id, label, status, score: Math.round(earned), max, detail, fix };
}

export function normalizeUrl(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    // This endpoint fetches arbitrary URLs, so keep it off internal targets.
    const h = u.hostname.toLowerCase();
    if (
      h === "localhost" ||
      h.endsWith(".local") ||
      h.endsWith(".internal") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(h) ||
      h.startsWith("[")
    ) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

export async function scan(target: string): Promise<ScanResult> {
  const started = Date.now();
  const url = normalizeUrl(target);
  if (!url) throw new Error("INVALID_URL");
  const page = await getPage(url);
  if (!page.ok || !page.text) throw new Error("UNREACHABLE");

  // Read the side files from whichever host actually served the page, so a
  // www fallback or a redirect does not send us to the wrong robots.txt.
  const origin = new URL(page.finalUrl).origin;
  const [robotsRes, llmsRes, sitemapRes] = await Promise.all([
    get(origin + "/robots.txt"),
    get(origin + "/llms.txt"),
    get(origin + "/sitemap.xml"),
  ]);

  const $raw = cheerio.load(page.text);
  const $ = cheerio.load(page.text);
  $("script, style, noscript, svg, template").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const words = bodyText ? bodyText.split(" ").length : 0;

  const categories: Category[] = [];

  // 1. AI crawler access (30)
  const groups = robotsRes.ok ? parseRobots(robotsRes.text) : [];
  const bots: BotStatus[] = AI_BOTS.map((b) => ({
    ua: b.ua,
    label: b.label,
    allowed: robotsRes.ok ? isAllowed(groups, b.ua) : true,
  }));
  const totalW = AI_BOTS.reduce((s, b) => s + b.weight, 0);
  const okW = AI_BOTS.reduce((s, b, i) => s + (bots[i].allowed ? b.weight : 0), 0);
  const blocked = bots.filter((b) => !b.allowed);
  categories.push({
    id: "access",
    label: "AI Crawler Access",
    blurb: "If these bots cannot read the page, nothing else matters.",
    max: 30,
    score: Math.round((okW / totalW) * 30),
    checks: [
      check(
        "robots",
        "robots.txt reachable",
        4,
        robotsRes.ok ? 4 : 2,
        robotsRes.ok
          ? "Found and parsed."
          : "No robots.txt found. Crawlers default to allowed, but you have no control.",
        robotsRes.ok
          ? undefined
          : "Add a robots.txt that explicitly allows AI crawlers."
      ),
      check(
        "bots",
        "AI crawlers allowed",
        26,
        (okW / totalW) * 26,
        blocked.length === 0
          ? `All ${bots.length} major AI crawlers can read this page.`
          : `Blocked: ${blocked.map((b) => b.label).join(", ")}.`,
        blocked.length
          ? "Remove the Disallow rules for these user-agents in robots.txt."
          : undefined
      ),
    ],
  });

  // 2. Content extractability (20)
  const shellSelectors = ["#root", "#__next", "#app", "[data-reactroot]"];
  const shellEmpty = shellSelectors.some((sel) => {
    const el = $(sel);
    return el.length > 0 && el.text().replace(/\s+/g, "").length < 200;
  });
  const textScore = words >= 300 ? 12 : words >= 120 ? 6 : 0;
  const shellScore = shellEmpty && words < 300 ? 0 : 8;
  categories.push({
    id: "extract",
    label: "Content Extractability",
    blurb:
      "Most AI crawlers do not run JavaScript. What ships in the HTML is all they see.",
    max: 20,
    score: textScore + shellScore,
    checks: [
      check(
        "text",
        "Readable text in raw HTML",
        12,
        textScore,
        `${words} words found before any JavaScript runs.`,
        words < 300
          ? "Server-render or statically generate your main content."
          : undefined
      ),
      check(
        "shell",
        "Not a client-only shell",
        8,
        shellScore,
        shellScore
          ? "Content is present server-side."
          : "Page looks like an empty JS shell. AI crawlers will see a blank page.",
        shellScore ? undefined : "Switch this route to SSR or SSG."
      ),
    ],
  });

  // 3. Structured data (20)
  const ldTypes = new Set<string>();
  let ldValid = 0;
  let sameAs = 0;
  $raw('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($raw(el).text());
      ldValid++;
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) {
          n.forEach(walk);
          return;
        }
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          const t = o["@type"];
          if (typeof t === "string") ldTypes.add(t);
          if (Array.isArray(t))
            t.forEach((x) => typeof x === "string" && ldTypes.add(x));
          if (o.sameAs) sameAs++;
          Object.values(o).forEach(walk);
        }
      };
      walk(json);
    } catch {
      // Malformed JSON-LD counts as absent.
    }
  });
  const KEY_TYPES = [
    "Organization",
    "LocalBusiness",
    "WebSite",
    "Product",
    "Article",
    "BlogPosting",
    "FAQPage",
    "BreadcrumbList",
    "Service",
    "Person",
  ];
  const hitTypes = KEY_TYPES.filter((t) => ldTypes.has(t));
  const typeScore = Math.min(7, hitTypes.length * 2.5);
  categories.push({
    id: "schema",
    label: "Structured Data",
    blurb:
      "Schema.org tells a model what your page is about, not just what it says.",
    max: 20,
    score: Math.round((ldValid ? 8 : 0) + typeScore + (sameAs ? 5 : 0)),
    checks: [
      check(
        "jsonld",
        "Valid JSON-LD present",
        8,
        ldValid ? 8 : 0,
        ldValid
          ? `${ldValid} JSON-LD block(s) parsed.`
          : "No parseable JSON-LD found.",
        ldValid
          ? undefined
          : "Add an Organization and WebSite JSON-LD block to your layout."
      ),
      check(
        "types",
        "Meaningful schema types",
        7,
        typeScore,
        hitTypes.length
          ? `Declared: ${hitTypes.join(", ")}.`
          : "No recognised schema types.",
        hitTypes.length >= 3
          ? undefined
          : "Add FAQPage and Organization markup, the two AI engines lean on most."
      ),
      check(
        "sameas",
        "Entity links (sameAs)",
        5,
        sameAs ? 5 : 0,
        sameAs
          ? "sameAs links present."
          : "No sameAs. Models cannot connect you to your other profiles.",
        sameAs
          ? undefined
          : "List your LinkedIn, Crunchbase and Wikipedia URLs in sameAs."
      ),
    ],
  });

  // 4. Answer-ready content (20)
  const h1 = $("h1").length;
  const subs = $("h2, h3").length;
  const headingText = $("h1, h2, h3")
    .map((_, el) => $(el).text())
    .get()
    .join(" ");
  const questiony =
    /\?|how |what |why |when |where |who |which |ทำไม|อะไร|อย่างไร|วิธี/i.test(
      headingText
    );
  const faq = ldTypes.has("FAQPage") || /faq|frequently asked/i.test(page.text);
  const lists = $("ul li, ol li").length;
  const tables = $("table").length;
  const paras = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 40);
  const avgLen = paras.length
    ? paras.reduce((s, p) => s + p.length, 0) / paras.length
    : 0;
  const conciseScore =
    paras.length === 0 ? 0 : avgLen <= 500 ? 4 : avgLen <= 800 ? 2 : 0;
  const h1Score = h1 === 1 ? 4 : h1 === 0 ? 0 : 2;
  const subScore = subs >= 4 ? 4 : subs >= 2 ? 2 : 0;
  const qScore = (questiony ? 2 : 0) + (faq ? 2 : 0);
  const listScore = lists >= 6 || tables >= 1 ? 4 : lists >= 2 ? 2 : 0;
  categories.push({
    id: "answers",
    label: "Answer-Ready Content",
    blurb:
      "Models quote self-contained, well-labelled chunks. Walls of prose get skipped.",
    max: 20,
    score: h1Score + subScore + qScore + listScore + conciseScore,
    checks: [
      check(
        "h1",
        "Exactly one H1",
        4,
        h1Score,
        `${h1} H1 tag(s) found.`,
        h1 === 1
          ? undefined
          : "Use a single H1 that states the page topic plainly."
      ),
      check(
        "subs",
        "Section headings",
        4,
        subScore,
        `${subs} H2/H3 heading(s).`,
        subs >= 4
          ? undefined
          : "Break content into labelled H2 sections a model can lift."
      ),
      check(
        "qa",
        "Question-shaped content",
        4,
        qScore,
        faq || questiony
          ? "Question phrasing or FAQ detected."
          : "No question-shaped headings or FAQ.",
        qScore === 4
          ? undefined
          : "Add an FAQ section using the exact questions customers ask."
      ),
      check(
        "lists",
        "Scannable lists or tables",
        4,
        listScore,
        `${lists} list item(s), ${tables} table(s).`,
        listScore === 4
          ? undefined
          : "Convert key comparisons and steps into lists or a table."
      ),
      check(
        "concise",
        "Concise paragraphs",
        4,
        conciseScore,
        paras.length
          ? `Average paragraph ${Math.round(avgLen)} characters.`
          : "No substantial paragraphs found.",
        conciseScore === 4
          ? undefined
          : "Answer in the first one or two sentences, then elaborate."
      ),
    ],
  });

  // 5. Trust and discoverability (10)
  const title = $raw("title").first().text().trim() || null;
  const desc = $raw('meta[name="description"]').attr("content")?.trim() || null;
  const metaScore =
    (title && title.length >= 10 ? 1.5 : 0) +
    (desc && desc.length >= 50 ? 1.5 : 0);
  const dated = /datemodified|datepublished|article:published_time/i.test(
    page.text
  );
  const authored = /author/i.test(page.text) || ldTypes.has("Person");
  const trustScore = (dated ? 1 : 0) + (authored ? 1 : 0);
  categories.push({
    id: "trust",
    label: "Trust & Discoverability",
    blurb:
      "Freshness and provenance decide which of two similar pages gets cited.",
    max: 10,
    score: Math.round(
      metaScore + trustScore + (sitemapRes.ok ? 3 : 0) + (llmsRes.ok ? 2 : 0)
    ),
    checks: [
      check(
        "meta",
        "Title and meta description",
        3,
        metaScore,
        `${title ? `Title: ${title.slice(0, 70)}` : "No title"} / ${
          desc ? "description present" : "no meta description"
        }.`,
        metaScore === 3
          ? undefined
          : "Write a 50-160 character description that answers what this page is."
      ),
      check(
        "fresh",
        "Date and author signals",
        2,
        trustScore,
        `${dated ? "Dates found" : "No date signals"} / ${
          authored ? "author found" : "no author"
        }.`,
        trustScore === 2
          ? undefined
          : "Publish dateModified and a named author in your schema."
      ),
      check(
        "sitemap",
        "sitemap.xml",
        3,
        sitemapRes.ok ? 3 : 0,
        sitemapRes.ok ? "Found." : "Not found at /sitemap.xml.",
        sitemapRes.ok
          ? undefined
          : "Generate a sitemap and reference it from robots.txt."
      ),
      check(
        "llms",
        "llms.txt",
        2,
        llmsRes.ok ? 2 : 0,
        llmsRes.ok
          ? "Found. You are ahead of most sites."
          : "Not found. Emerging standard, easy win.",
        llmsRes.ok
          ? undefined
          : "Add /llms.txt summarising your site for language models."
      ),
    ],
  });

  const score = Math.max(
    0,
    Math.min(
      100,
      categories.reduce((s, c) => s + c.score, 0)
    )
  );
  const grade =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  return {
    url,
    finalUrl: page.finalUrl,
    fetchedAt: new Date().toISOString(),
    ms: Date.now() - started,
    score,
    grade,
    categories,
    bots,
    meta: { title, description: desc, words },
  };
}
