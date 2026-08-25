interface Rule {
  allow: boolean;
  path: string;
}
interface Group {
  agents: string[];
  rules: Rule[];
}

/** Minimal RFC 9309 robots.txt parser: groups consecutive User-agent lines. */
export function parseRobots(txt: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;

  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();

    if (field === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "disallow" || field === "allow") {
      if (!cur) {
        cur = { agents: ["*"], rules: [] };
        groups.push(cur);
      }
      cur.rules.push({ allow: field === "allow", path: value });
      lastWasAgent = false;
    }
  }
  return groups;
}

function matchesRoot(path: string): boolean {
  if (path === "" ) return false;      // "Disallow:" with no value = allow everything
  if (path === "/" || path === "/*") return true;
  return "/".startsWith(path);
}

/** Does this rule set block the site root for the agent? Longest match wins, Allow breaks ties. */
function blocksRoot(rules: Rule[]): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!matchesRoot(r.path)) continue;
    if (
      !best ||
      r.path.length > best.path.length ||
      (r.path.length === best.path.length && r.allow)
    ) {
      best = r;
    }
  }
  return best ? !best.allow : false;
}

/** True when the named crawler may fetch the homepage. */
export function isAllowed(groups: Group[], ua: string): boolean {
  const needle = ua.toLowerCase();
  const exact = groups.find((g) => g.agents.includes(needle));
  if (exact) return !blocksRoot(exact.rules);

  // Some sites write partial tokens, e.g. "User-agent: Claude" for ClaudeBot.
  const partial = groups.find((g) =>
    g.agents.some((a) => a !== "*" && (needle.includes(a) || a.includes(needle)))
  );
  if (partial) return !blocksRoot(partial.rules);

  const wildcard = groups.find((g) => g.agents.includes("*"));
  if (wildcard) return !blocksRoot(wildcard.rules);
  return true;
}
