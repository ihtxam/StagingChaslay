import api from '@/lib/api';
import { compressImageIfNeeded } from '@/lib/compress-image';

export type PageBuilderImageUploadOpts = {
  /** Max file size before compression kicks in (bytes). */
  maxBytes?: number;
  /** Target output size after compression (bytes). */
  targetBytes?: number;
  /** Max width in pixels. */
  maxWidth?: number;
};

/** Compress and upload to merchant media storage; returns a short public URL (not base64). */
export async function uploadPageBuilderImage(
  file: File,
  opts: PageBuilderImageUploadOpts = {}
): Promise<string> {
  const maxBytes = opts.maxBytes ?? 500 * 1024;
  const targetBytes = opts.targetBytes ?? Math.min(maxBytes, 320 * 1024);
  const maxWidth = opts.maxWidth ?? 1600;

  const compressed = await compressImageIfNeeded(file, { maxBytes, targetBytes, maxWidth });
  const fd = new FormData();
  fd.append('file', compressed);
  const res = await api.post('/merchant/media', fd);
  const url = res.data?.url as string | undefined;
  if (!url) {
    throw new Error('Upload succeeded but no URL was returned');
  }
  return url;
}
