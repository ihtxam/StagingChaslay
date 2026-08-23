import type { OpenPageSiteConfig } from '@/lib/cms/openpage-types';

export const CMS_DYNAMIC_BLOCK_TYPES = new Set(['menu', 'hours', 'reservations']);

export function isDynamicCmsBlock(block: {
  type: string;
  props?: Record<string, unknown>;
}): boolean {
  if (CMS_DYNAMIC_BLOCK_TYPES.has(block.type)) return true;
  if (block.type === 'featured') {
    const src = block.props?.source;
    const ids = block.props?.productIds;
    if (src === 'pos') return true;
    if (Array.isArray(ids) && ids.length > 0) return true;
    if (typeof ids === 'string' && ids.trim()) return true;
  }
  return false;
}

export function parseIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export type HomepageSegment =
  | { kind: 'static'; html: string }
  | {
      kind: 'dynamic';
      blockId: string;
      blockType: string;
      props: Record<string, unknown>;
    };

function blockMarker(blockId: string, blockType: string, close = false): string {
  return close
    ? `<!-- /CHASLAY_BLOCK:${blockId} -->`
    : `<!-- CHASLAY_BLOCK:${blockId}:${blockType} -->`;
}

/** Split exported OpenPage HTML into static fragments and dynamic block slots (in block order). */
export function splitOpenPageHtml(
  html: string,
  config: OpenPageSiteConfig
): HomepageSegment[] {
  const blocks = config.blocks || [];
  if (!blocks.length) {
    return html.trim() ? [{ kind: 'static', html }] : [];
  }

  const segments: HomepageSegment[] = [];
  let cursor = 0;

  for (const block of blocks) {
    const start = blockMarker(block.id, block.type);
    const end = blockMarker(block.id, block.type, true);
    const startIdx = html.indexOf(start, cursor);
    if (startIdx === -1) {
      if (isDynamicCmsBlock(block)) {
        segments.push({
          kind: 'dynamic',
          blockId: block.id,
          blockType: block.type,
          props: block.props || {},
        });
      }
      continue;
    }

    if (startIdx > cursor) {
      const between = html.slice(cursor, startIdx);
      if (between.trim()) segments.push({ kind: 'static', html: between });
    }

    const endIdx = html.indexOf(end, startIdx + start.length);
    if (isDynamicCmsBlock(block)) {
      segments.push({
        kind: 'dynamic',
        blockId: block.id,
        blockType: block.type,
        props: block.props || {},
      });
      cursor = endIdx === -1 ? html.length : endIdx + end.length;
      continue;
    }

    if (endIdx === -1) {
      segments.push({ kind: 'static', html: html.slice(startIdx) });
      cursor = html.length;
      break;
    }

    segments.push({ kind: 'static', html: html.slice(startIdx, endIdx + end.length) });
    cursor = endIdx + end.length;
  }

  if (cursor < html.length) {
    const tail = html.slice(cursor);
    if (tail.trim()) segments.push({ kind: 'static', html: tail });
  }

  return segments;
}

/** Extract `<body>...</body>` inner HTML from a full OpenPage export document. */
export function extractOpenPageBody(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : html;
}

/** Extract `<style>` blocks from head for static segment styling. */
export function extractOpenPageHeadAssets(html: string): { styles: string; fontLink: string } {
  const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  const styles = styleMatches.map((m) => m[0]).join('\n');
  const fontMatch = html.match(/<link[^>]+fonts\.googleapis\.com[^>]*>/i);
  return { styles, fontLink: fontMatch ? fontMatch[0] : '' };
}
