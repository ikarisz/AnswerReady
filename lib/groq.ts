import type { ScanResult } from "./types";

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/**
 * Turns the raw scan into a plain-language verdict plus ranked fixes.
 * Returns undefined when no key is configured — the report stands on its own.
 */
export async function explain(
  result: ScanResult
): Promise<ScanResult["ai"] | undefined> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return undefined;

  const failing = result.categories
    .flatMap((c) => c.checks.map((k) => ({ ...k, cat: c.label })))
    .filter((k) => k.status !== "pass")
    .map((k) => `- [${k.cat}] ${k.label}: ${k.detail} ${k.fix ?? ""}`)
    .join("\n");

  const prompt = `Site: ${result.finalUrl}
Overall AI-search readiness: ${result.score}/100 (grade ${result.grade})
Category scores: ${result.categories
    .map((c) => `${c.label} ${c.score}/${c.max}`)
    .join(", ")}

Failing or partial checks:
${failing || "(none — everything passed)"}

Write for the site owner, who is a business person, not an engineer.
Return strict JSON only, no markdown fence:
{"verdict":"two sentences on what this score means for their visibility in ChatGPT, Perplexity and Google AI Overviews","actions":["4 to 6 concrete fixes, highest impact first, each one sentence, naming the specific file or tag to change"]}`;

  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
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
      }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
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
