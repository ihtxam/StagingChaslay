import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanPublishedPrBody,
  groupPublishedPrsByDay,
  githubRepoAccessError,
  parseGitMergeLog,
  parseGithubPull,
  parsePublishedPrSnapshot,
  publishedPrDayKey,
  resolvePublishedPrRepo,
} from "./published-pr";

describe("published-pr", () => {
  it("keeps the human notes and drops Cursor metadata comments", () => {
    const body = cleanPublishedPrBody(`
<!-- CURSOR_AGENT_PR_BODY_BEGIN -->
Fix Superadmin create merchant crash.
<!-- CURSOR_AGENT_PR_BODY_END -->
<!-- cursor-meta -->hidden<!-- /cursor-meta -->
`);
    assert.equal(body, "Fix Superadmin create merchant crash.");
  });

  it("parses only merged GitHub pulls", () => {
    assert.equal(parseGithubPull({ number: 12, title: "Open", merged_at: null }), null);
    const parsed = parseGithubPull({
      number: 707,
      title: "fix create merchant",
      body: "Cannot read label",
      html_url: "https://github.com/ihtxam/rebornSense/pull/707",
      merged_at: "2026-10-12T15:40:00.000Z",
      user: { login: "ihtxam" },
      base: { ref: "main" },
    });
    assert.ok(parsed);
    assert.equal(parsed.number, 707);
    assert.equal(parsed.author, "ihtxam");
    assert.equal(parsed.body, "Cannot read label");
  });

  it("groups merged PRs by Europe/Zurich day newest first", () => {
    const days = groupPublishedPrsByDay([
      { mergedAt: "2026-10-12T08:00:00.000Z", title: "morning" },
      { mergedAt: "2026-10-11T10:00:00.000Z", title: "late" },
      { mergedAt: "2026-10-12T16:00:00.000Z", title: "afternoon" },
    ]);
    assert.equal(days[0]?.date, publishedPrDayKey("2026-10-12T16:00:00.000Z"));
    assert.deepEqual(
      days[0]?.prs.map((p) => p.title),
      ["afternoon", "morning"]
    );
    assert.equal(days.length, 2);
  });

  it("falls back to the Reborn repo when the override is invalid", () => {
    assert.equal(resolvePublishedPrRepo("ihtxam/rebornSense"), "ihtxam/rebornSense");
    assert.equal(resolvePublishedPrRepo("not a repo"), "ihtxam/rebornSense");
  });

  it("explains private-repo 404 when no token is configured", () => {
    const missing = githubRepoAccessError(404, "ihtxam/rebornSense", false);
    assert.match(String(missing), /private repository/);
    assert.doesNotMatch(String(missing), /repo not found/);
    const hidden = githubRepoAccessError(404, "ihtxam/rebornSense", true);
    assert.match(String(hidden), /could not access/);
  });

  it("parses merge commits exported from git log", () => {
    const parsed = parseGitMergeLog(
      `
===
2026-10-13T13:59:36Z
GitHub
Merge pull request #746 from ihtxam/cursor/reseller-package-hard-delete-1b4f
feat(reseller): hard-delete own packages instead of deactivate
`,
      "ihtxam/rebornSense"
    );
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.number, 746);
    assert.equal(parsed[0]?.title, "feat(reseller): hard-delete own packages instead of deactivate");
    assert.equal(parsed[0]?.htmlUrl, "https://github.com/ihtxam/rebornSense/pull/746");
    assert.equal(parsePublishedPrSnapshot("===\n2026-10-13T13:59:36Z\nGitHub\nMerge pull request #1 from x/y\nTitle").length, 1);
  });
});
