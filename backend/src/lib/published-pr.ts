const CURSOR_BODY_BEGIN = "<!-- CURSOR_AGENT_PR_BODY_BEGIN -->";
const CURSOR_BODY_END = "<!-- CURSOR_AGENT_PR_BODY_END -->";

export const DEFAULT_PUBLISHED_PR_REPO = "ihtxam/rebornSense";
export const PUBLISHED_PR_TIMEZONE = "Europe/Zurich";

export type PublishedPrRecord = {
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  author: string;
  baseBranch: string;
  mergedAt: Date;
};

export type GithubPullLike = {
  number?: unknown;
  title?: unknown;
  body?: unknown;
  html_url?: unknown;
  htmlUrl?: unknown;
  merged_at?: unknown;
  mergedAt?: unknown;
  user?: { login?: unknown } | null;
  author?: { login?: unknown } | string | null;
  base?: { ref?: unknown } | null;
};

export function cleanPublishedPrBody(raw: string | null | undefined): string {
  let text = String(raw || "");
  const start = text.indexOf(CURSOR_BODY_BEGIN);
  const stop = text.indexOf(CURSOR_BODY_END);
  if (start >= 0 && stop > start) {
    text = text.slice(start + CURSOR_BODY_BEGIN.length, stop);
  }
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  return text.slice(0, 8000);
}

export function parseGithubPull(raw: GithubPullLike | null | undefined): PublishedPrRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const number = Number(raw.number);
  if (!Number.isInteger(number) || number <= 0) return null;
  const mergedRaw = raw.merged_at ?? raw.mergedAt;
  if (!mergedRaw) return null;
  const mergedAt = new Date(String(mergedRaw));
  if (Number.isNaN(mergedAt.getTime())) return null;
  const title = String(raw.title || "").trim() || `PR #${number}`;
  const htmlUrl = String(raw.html_url || raw.htmlUrl || "").trim();
  const authorLogin =
    typeof raw.author === "string"
      ? raw.author
      : raw.author && typeof raw.author === "object"
        ? String(raw.author.login || "")
        : String(raw.user?.login || "");
  return {
    number,
    title: title.slice(0, 500),
    body: cleanPublishedPrBody(typeof raw.body === "string" ? raw.body : ""),
    htmlUrl: htmlUrl.slice(0, 500),
    author: authorLogin.trim().slice(0, 120),
    baseBranch: String(raw.base?.ref || "").trim().slice(0, 80),
    mergedAt,
  };
}

export function publishedPrDayKey(value: Date | string, timeZone = PUBLISHED_PR_TIMEZONE): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function groupPublishedPrsByDay<T extends { mergedAt: Date | string }>(
  rows: T[],
  timeZone = PUBLISHED_PR_TIMEZONE
): Array<{ date: string; prs: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const key = publishedPrDayKey(row.mergedAt, timeZone);
    if (!key) continue;
    const list = buckets.get(key) || [];
    list.push(row);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, prs]) => ({
      date,
      prs: [...prs].sort((a, b) => {
        const ta = new Date(a.mergedAt).getTime();
        const tb = new Date(b.mergedAt).getTime();
        return tb - ta;
      }),
    }));
}

export function resolvePublishedPrRepo(raw?: string | null): string {
  const value = String(raw || process.env.GITHUB_REPO || DEFAULT_PUBLISHED_PR_REPO).trim();
  return /^[\w.-]+\/[\w.-]+$/.test(value) ? value : DEFAULT_PUBLISHED_PR_REPO;
}
