import { desc, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  groupPublishedPrsByDay,
  parseGithubPull,
  resolvePublishedPrRepo,
  type GithubPullLike,
  type PublishedPrRecord,
} from "@/lib/published-pr";
import { PlatformSettingsService } from "@/services/platform-settings.service";

export const PUBLISHED_PR_TOKEN_KEY = "github_published_prs_token";
export const PUBLISHED_PR_REPO_KEY = "github_published_prs_repo";
export const PUBLISHED_PR_SYNCED_AT_KEY = "github_published_prs_synced_at";

const STALE_MS = 10 * 60 * 1000;
const MAX_PAGES = 5;

function serialize(row: typeof schema.publishedPullRequests.$inferSelect) {
  return {
    number: row.number,
    title: row.title,
    body: row.body || "",
    htmlUrl: row.htmlUrl || "",
    author: row.author || "",
    baseBranch: row.baseBranch || "",
    mergedAt: row.mergedAt,
  };
}

function maskToken(value?: string | null) {
  const token = String(value || "").trim();
  if (!token) return "";
  if (token.length <= 8) return "••••••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export class PublishedPrService {
  static async resolveRepo() {
    const stored = await PlatformSettingsService.get(PUBLISHED_PR_REPO_KEY);
    return resolvePublishedPrRepo(stored);
  }

  static async resolveToken() {
    const stored = await PlatformSettingsService.get(PUBLISHED_PR_TOKEN_KEY);
    return (
      String(stored || "").trim() ||
      String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim()
    );
  }

  static async config() {
    const repo = await this.resolveRepo();
    const token = await this.resolveToken();
    const syncedAt = await PlatformSettingsService.get(PUBLISHED_PR_SYNCED_AT_KEY);
    return {
      repo,
      tokenConfigured: !!token,
      tokenMasked: maskToken(token),
      syncedAt,
    };
  }

  static async saveConfig(input: { repo?: string; token?: string | null }) {
    if (input.repo !== undefined) {
      await PlatformSettingsService.set(PUBLISHED_PR_REPO_KEY, resolvePublishedPrRepo(input.repo));
    }
    if (input.token !== undefined) {
      const next = input.token == null ? "" : String(input.token).trim();
      if (next && !/^•+$/.test(next) && !next.includes("••••")) {
        await PlatformSettingsService.set(PUBLISHED_PR_TOKEN_KEY, next);
      }
      if (next === "") {
        await PlatformSettingsService.set(PUBLISHED_PR_TOKEN_KEY, "");
      }
    }
    return this.config();
  }

  static async list(days = 30) {
    const { ensureMerchantTables } = await import("@/lib/ensure-merchant-schema");
    await ensureMerchantTables();
    await this.ensureFresh();
    const db = getDb();
    const since =
      days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
    const query = db.select().from(schema.publishedPullRequests);
    const rows = await (since
      ? query.where(gte(schema.publishedPullRequests.mergedAt, since))
      : query
    ).orderBy(desc(schema.publishedPullRequests.mergedAt));
    const config = await this.config();
    return {
      ...config,
      days,
      total: rows.length,
      groups: groupPublishedPrsByDay(rows.map(serialize)),
    };
  }

  static async ensureFresh() {
    const syncedAt = await PlatformSettingsService.get(PUBLISHED_PR_SYNCED_AT_KEY);
    const age = syncedAt ? Date.now() - new Date(syncedAt).getTime() : Number.POSITIVE_INFINITY;
    const db = getDb();
    const existing = await db.select().from(schema.publishedPullRequests).limit(1);
    if (existing.length && age < STALE_MS) return;
    try {
      await this.sync();
    } catch (error) {
      if (existing.length) return;
      throw error;
    }
  }

  static async sync() {
    const { ensureMerchantTables } = await import("@/lib/ensure-merchant-schema");
    await ensureMerchantTables();
    const repo = await this.resolveRepo();
    const token = await this.resolveToken();
    const pulls = await this.fetchMergedPulls(repo, token);
    const db = getDb();
    const now = new Date();
    for (const pr of pulls) {
      await db
        .insert(schema.publishedPullRequests)
        .values({
          number: pr.number,
          title: pr.title,
          body: pr.body,
          htmlUrl: pr.htmlUrl,
          author: pr.author,
          baseBranch: pr.baseBranch,
          mergedAt: pr.mergedAt,
          syncedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.publishedPullRequests.number,
          set: {
            title: pr.title,
            body: pr.body,
            htmlUrl: pr.htmlUrl,
            author: pr.author,
            baseBranch: pr.baseBranch,
            mergedAt: pr.mergedAt,
            syncedAt: now,
            updatedAt: now,
          },
        });
    }
    await PlatformSettingsService.set(PUBLISHED_PR_SYNCED_AT_KEY, now.toISOString());
    return {
      ...(await this.config()),
      imported: pulls.length,
    };
  }

  static async fetchMergedPulls(repo: string, token: string): Promise<PublishedPrRecord[]> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "RebornSense-Superadmin",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const found: PublishedPrRecord[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url = `https://api.github.com/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            "GitHub refused the request. Add a repo token under Superadmin → Published PRs, or set GITHUB_TOKEN."
          );
        }
        if (res.status === 404) {
          throw new Error(`GitHub repo not found: ${repo}`);
        }
        throw new Error(`GitHub pull list failed (${res.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
      }
      const payload = (await res.json()) as GithubPullLike[];
      if (!Array.isArray(payload) || payload.length === 0) break;
      for (const row of payload) {
        const parsed = parseGithubPull(row);
        if (parsed) found.push(parsed);
      }
      if (payload.length < 100) break;
    }
    const unique = new Map<number, PublishedPrRecord>();
    for (const pr of found) unique.set(pr.number, pr);
    return [...unique.values()];
  }
}
