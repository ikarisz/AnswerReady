"use client";

import { useState } from "react";
import type { ScanResult, CheckStatus } from "@/lib/types";

const TONE: Record<CheckStatus, { dot: string; text: string }> = {
  pass: { dot: "bg-good", text: "text-good" },
  warn: { dot: "bg-warn", text: "text-warn" },
  fail: { dot: "bg-bad", text: "text-bad" },
};

function toneFor(score: number, max: number): CheckStatus {
  const r = score / max;
  return r >= 0.85 ? "pass" : r >= 0.5 ? "warn" : "fail";
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const tone = toneFor(score, 100);
  const stroke =
    tone === "pass" ? "#34d399" : tone === "warn" ? "#fbbf24" : "#f87171";
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#1e222a" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-semibold tabular-nums">{score}</span>
        <span className="text-xs tracking-widest text-mute">GRADE {grade}</span>
      </div>
    </div>
  );
}

export default function Scanner() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Scan failed.");
      else setResult(data);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const blocked = result?.bots.filter((b) => !b.allowed) ?? [];

  return (
    <div id="scan" className="w-full">
      <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourcompany.com"
          aria-label="Website address"
          className="flex-1 rounded-lg border border-line bg-panel px-4 py-3.5 text-base outline-none placeholder:text-mute focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-6 py-3.5 font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Scanning…" : "Scan free"}
        </button>
      </form>
      <p className="mt-2.5 text-sm text-mute">
        No signup. Takes about 10 seconds. We only read your public homepage.
      </p>

      {error && (
        <div className="rise mt-6 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      {result && (
        <div className="rise mt-8 space-y-5">
          {/* Headline score */}
          <section className="rounded-xl border border-line bg-panel p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <ScoreRing score={result.score} grade={result.grade} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-mute">
                  {result.finalUrl}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {result.score >= 75
                    ? "AI engines can find and quote you."
                    : result.score >= 50
                      ? "Partly visible. You are leaving citations on the table."
                      : "AI engines are mostly missing you."}
                </h2>
                {result.ai?.verdict && (
                  <p className="mt-2 text-[15px] leading-relaxed text-mute">
                    {result.ai.verdict}
                  </p>
                )}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {result.categories.map((c) => {
                    const t = toneFor(c.score, c.max);
                    return (
                      <div key={c.id} className="text-sm">
                        <div className="flex justify-between">
                          <span className="text-mute">{c.label}</span>
                          <span className="font-mono tabular-nums">
                            {c.score}/{c.max}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                          <div
                            className={`h-full ${TONE[t].dot}`}
                            style={{ width: `${(c.score / c.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Crawler access — the headline finding */}
          <section className="rounded-xl border border-line bg-panel p-6">
            <h3 className="font-semibold">Which AI engines can read this site</h3>
            {blocked.length > 0 && (
              <p className="mt-1 text-sm text-bad">
                {blocked.length} of {result.bots.length} are blocked in your
                robots.txt. They cannot cite what they cannot fetch.
              </p>
            )}
            <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {result.bots.map((b) => (
                <li key={b.ua} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${b.allowed ? "bg-good" : "bg-bad"}`}
                  />
                  <span className={b.allowed ? "" : "text-bad"}>{b.label}</span>
                  <span className="ml-auto font-mono text-xs text-mute">
                    {b.allowed ? "allowed" : "blocked"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Priority fixes */}
          {result.ai?.actions?.length ? (
            <section className="rounded-xl border border-brand/25 bg-brand/[0.04] p-6">
              <h3 className="font-semibold">Do these first</h3>
              <ol className="mt-3 space-y-2.5">
                {result.ai.actions.map((a, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="font-mono text-sm text-brand">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* Full breakdown */}
          {result.categories.map((c) => (
            <section key={c.id} className="rounded-xl border border-line bg-panel p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-semibold">{c.label}</h3>
                <span className="font-mono text-sm tabular-nums text-mute">
                  {c.score}/{c.max}
                </span>
              </div>
              <p className="mt-1 text-sm text-mute">{c.blurb}</p>
              <ul className="mt-4 space-y-3">
                {c.checks.map((k) => (
                  <li key={k.id} className="flex gap-3">
                    <span
                      className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${TONE[k.status].dot}`}
                    />
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium">{k.label}</p>
                      <p className="text-sm text-mute">{k.detail}</p>
                      {k.fix && (
                        <p className={`mt-0.5 text-sm ${TONE[k.status].text}`}>
                          Fix: {k.fix}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* Upsell */}
          <section className="rounded-xl border border-line bg-panel p-6 text-center">
            <h3 className="text-lg font-semibold">
              This was one page. Your customers ask about all of them.
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-[15px] text-mute">
              The full report audits up to 50 pages, compares you against two
              competitors, and hands your developer a copy-paste fix list.
            </p>
            <a
              href="#pricing"
              className="mt-5 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-ink transition hover:opacity-90"
            >
              See the full report
            </a>
            <p className="mt-3 font-mono text-xs text-mute">
              scanned in {(result.ms / 1000).toFixed(1)}s · {result.meta.words} words
              read
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
