import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { formatPanelDatedBuildTag, panelBuildDayKey } from '../src/lib/panel-build-tag.ts';

const dashboardRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const seqPath = path.join(dashboardRoot, '.panel-build-seq.json');

export type PanelBuildMeta = {
  gitSha: string;
  datedTag: string;
};

function readState(): { dayKey: string; seq: number } {
  if (!existsSync(seqPath)) return { dayKey: '', seq: 0 };
  try {
    const raw = JSON.parse(readFileSync(seqPath, 'utf-8')) as { dayKey?: string; seq?: number };
    return {
      dayKey: String(raw.dayKey || ''),
      seq: Number.isFinite(raw.seq) ? Number(raw.seq) : 0,
    };
  } catch {
    return { dayKey: '', seq: 0 };
  }
}

function writeState(dayKey: string, seq: number): void {
  mkdirSync(path.dirname(seqPath), { recursive: true });
  writeFileSync(seqPath, `${JSON.stringify({ dayKey, seq }, null, 2)}\n`, 'utf-8');
}

export function resolveGitBuildStamp(): string {
  const override = process.env.REBORN_BUILD_STAMP?.trim();
  if (override) return override;
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: dashboardRoot }).trim();
    if (sha) return sha;
  } catch {
    /* outside git or git unavailable */
  }
  return new Date().toISOString().slice(0, 19);
}

export function resolvePanelDatedBuildTag(now = new Date()): string {
  const tagOverride = process.env.REBORN_PANEL_BUILD_TAG?.trim();
  if (tagOverride) return tagOverride;

  const seqOverride = Number(process.env.REBORN_PANEL_BUILD_SEQ);
  if (Number.isFinite(seqOverride) && seqOverride > 0) {
    return formatPanelDatedBuildTag(now, seqOverride);
  }

  const dayKey = panelBuildDayKey(now);
  const state = readState();
  const seq = state.dayKey === dayKey ? state.seq + 1 : 1;
  writeState(dayKey, seq);
  return formatPanelDatedBuildTag(now, seq);
}

export function resolvePanelBuildMeta(): PanelBuildMeta {
  return {
    gitSha: resolveGitBuildStamp(),
    datedTag: resolvePanelDatedBuildTag(),
  };
}
