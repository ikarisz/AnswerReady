/**
 * Batch-scans a list of sites and prints the aggregate stats we need for the
 * launch post. Runs the engine directly, so it neither hits our production
 * rate limit nor spends tokens on verdicts we are not going to publish.
 *
 *   npx tsx scripts/batch.ts scripts/thai-sites.txt
 */
import { readFileSync, writeFileSync } from "node:fs";
import { scan } from "../lib/scan";
import type { ScanResult } from "../lib/types";

const CONCURRENCY = 6;

type Row =
  | { site: string; ok: true; result: ScanResult }
  | { site: string; ok: false; error: string };

async function main() {
  const file = process.argv[2];
  const sites = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));

  console.log(`Scanning ${sites.length} sites at concurrency ${CONCURRENCY}\n`);

  const rows: Row[] = [];
  const queue = [...sites];

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const site = queue.shift();
        if (!site) return;
        try {
          const result = await scan(site);
          rows.push({ site, ok: true, result });
          const blocked = result.bots.filter((b) => !b.allowed).length;
          console.log(
            `${String(result.score).padStart(3)} ${result.grade}  ${site.padEnd(30)}${
              blocked ? `blocks ${blocked} AI crawlers` : ""
            }`
          );
        } catch (e) {
          const error = e instanceof Error ? e.message : "FAILED";
          rows.push({ site, ok: false, error });
          console.log(`  -    ${site.padEnd(30)}${error}`);
        }
      }
    })
  );

  const good = rows.filter((r): r is Extract<Row, { ok: true }> => r.ok);
  const scores = good.map((r) => r.result.score).sort((a, b) => a - b);
  const median = scores[Math.floor(scores.length / 2)];
  const avg = Math.round(scores.reduce((s, n) => s + n, 0) / scores.length);

  const blockers = good.filter((r) =>
    r.result.bots.some((b) => !b.allowed)
  );
  const noSchema = good.filter(
    (r) =>
      r.result.categories.find((c) => c.id === "schema")!.checks[0].status ===
      "fail"
  );
  const thinHtml = good.filter(
    (r) =>
      r.result.categories.find((c) => c.id === "extract")!.checks[0].status !==
      "pass"
  );
  const noLlms = good.filter(
    (r) =>
      r.result.categories
        .find((c) => c.id === "trust")!
        .checks.find((k) => k.id === "llms")!.status === "fail"
  );
  const failing = good.filter((r) => r.result.score < 60);

  const pct = (n: number) => Math.round((n / good.length) * 100);

  const report = `
================ AGGREGATE (${good.length} sites scanned, ${rows.length - good.length} unreachable) ================

  Average score        ${avg}/100
  Median score         ${median}/100
  Scoring below 60 (D or F)   ${failing.length}/${good.length}  (${pct(failing.length)}%)

  Blocking at least one AI crawler   ${blockers.length}  (${pct(blockers.length)}%)
  No valid JSON-LD structured data   ${noSchema.length}  (${pct(noSchema.length)}%)
  Thin or JS-only HTML               ${thinHtml.length}  (${pct(thinHtml.length)}%)
  No llms.txt                        ${noLlms.length}  (${pct(noLlms.length)}%)

--- TOP 10 (safe to name publicly) ---
${good
  .sort((a, b) => b.result.score - a.result.score)
  .slice(0, 10)
  .map((r) => `  ${String(r.result.score).padStart(3)} ${r.result.grade}  ${r.site}`)
  .join("\n")}

--- WHO BLOCKS WHICH ENGINE ---
${(() => {
  const counts = new Map<string, number>();
  for (const r of good)
    for (const b of r.result.bots)
      if (!b.allowed) counts.set(b.label, (counts.get(b.label) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `  ${String(n).padStart(3)} sites block ${label}`)
    .join("\n") || "  (none)";
})()}
`;
  console.log(report);
  writeFileSync(
    "scripts/results.json",
    JSON.stringify(
      good.map((r) => ({
        site: r.site,
        score: r.result.score,
        grade: r.result.grade,
        categories: Object.fromEntries(
          r.result.categories.map((c) => [c.id, `${c.score}/${c.max}`])
        ),
        blocked: r.result.bots.filter((b) => !b.allowed).map((b) => b.label),
      })),
      null,
      2
    )
  );
  writeFileSync("scripts/report.txt", report);
  console.log("Wrote scripts/results.json and scripts/report.txt");
}

main();
