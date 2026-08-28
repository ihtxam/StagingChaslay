import { compressImageIfNeeded } from '@/lib/compress-image'

function apiBase(): string {
  const env = import.meta.env.VITE_API_URL as string | undefined
  if (env) return env.replace(/\/$/, '')
  return '/api'
}

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/** Upload an image to merchant media storage; returns public URL. */
export async function uploadMerchantImage(file: File): Promise<string> {
  const compressed = await compressImageIfNeeded(file, {
    maxBytes: 500 * 1024,
    targetBytes: 400 * 1024,
    maxWidth: 1800,
  })
  const fd = new FormData()
  fd.append('file', compressed)
  const res = await fetch(`${apiBase()}/merchant/media`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`)
  }
  if (!data.url) {
    throw new Error('Upload succeeded but no URL returned')
  }
  return data.url
}
