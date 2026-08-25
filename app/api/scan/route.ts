import { NextResponse } from "next/server";
import { scan } from "@/lib/scan";
import { explain } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// One scan at a time per IP, so a single visitor cannot pin the function.
const recent = new Map<string, number>();
const WINDOW_MS = 8_000;

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const now = Date.now();
  const last = recent.get(ip) ?? 0;
  if (now - last < WINDOW_MS) {
    return NextResponse.json(
      { error: "Give it a few seconds between scans." },
      { status: 429 }
    );
  }
  recent.set(ip, now);
  if (recent.size > 5000) recent.clear();

  let url: string;
  try {
    const body = await req.json();
    url = typeof body?.url === "string" ? body.url : "";
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const result = await scan(url);
    result.ai = await explain(result);
    return NextResponse.json(result);
  } catch (err) {
    const code = err instanceof Error ? err.message : "FAILED";
    const message =
      code === "INVALID_URL"
        ? "That does not look like a public website address."
        : code === "UNREACHABLE"
          ? "This site refused our request or did not answer within 20 seconds. That is worth knowing on its own: bot protection and slow origins turn AI crawlers away the same way they turned us away. Check your WAF or bot-protection rules, or try a specific page URL."
          : "Scan failed. Try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
