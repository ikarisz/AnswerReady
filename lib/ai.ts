import type { ScanResult } from "./types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://answerready.io";

interface Provider {
  name: string;
  url: string;
  key: string | undefined;
  model: string;
  headers?: Record<string, string>;
}

/**
 * Both providers speak the OpenAI chat-completions dialect, so one request
 * body serves either. OpenRouter leads because it is cheaper per token and
 * new models appear there first; Groq stands behind it as a live fallback so
 * a single provider outage does not blank out the report.
 */
function providers(): Provider[] {
  return [
    {
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b",
      // OpenRouter lists apps that send these, which is free distribution.
      headers: { "HTTP-Referer": SITE, "X-Title": "AnswerReady" },
    },
    {
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    },
  ].filter((p) => !!p.key);
}

function buildPrompt(result: ScanResult): string {
  const failing = result.categories
    .flatMap((c) => c.checks.map((k) => ({ ...k, cat: c.label })))
    .filter((k) => k.status !== "pass")
    .map((k) => `- [${k.cat}] ${k.label}: ${k.detail} ${k.fix ?? ""}`)
    .join("\n");

  return `Site: ${result.finalUrl}
Overall AI-search readiness: ${result.score}/100 (grade ${result.grade})
Category scores: ${result.categories
    .map((c) => `${c.label} ${c.score}/${c.max}`)
    .join(", ")}

Failing or partial checks:
${failing || "(none - everything passed)"}

Write for the site owner, who is a business person, not an engineer.
Return strict JSON only, no markdown fence:
{"verdict":"two sentences on what this score means for their visibility in ChatGPT, Perplexity and Google AI Overviews","actions":["4 to 6 concrete fixes, highest impact first, each one sentence, naming the specific file or tag to change"]}`;
}

function parse(raw: string): ScanResult["ai"] | undefined {
  // Some models wrap JSON in a fence despite being told not to.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(cleaned);
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter((a: unknown) => typeof a === "string").slice(0, 6)
      : [];
    if (typeof parsed.verdict !== "string" || actions.length === 0)
      return undefined;
    return { verdict: parsed.verdict, actions };
  } catch {
    return undefined;
  }
}

async function ask(
  p: Provider,
  prompt: string
): Promise<ScanResult["ai"] | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(p.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        authorization: `Bearer ${p.key}`,
        "content-type": "application/json",
        ...(p.headers ?? {}),
      },
      body: JSON.stringify({
        model: p.model,
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an AI-search optimisation consultant. You are precise, never invent findings beyond the data given, and never pad.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    return typeof raw === "string" ? parse(raw) : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turns the raw scan into a plain-language verdict plus ranked fixes.
 * Returns undefined when every provider is unavailable - the deterministic
 * report stands on its own.
 */
export async function explain(
  result: ScanResult
): Promise<ScanResult["ai"] | undefined> {
  const prompt = buildPrompt(result);
  for (const p of providers()) {
    const out = await ask(p, prompt);
    if (out) return out;
  }
  return undefined;
}
