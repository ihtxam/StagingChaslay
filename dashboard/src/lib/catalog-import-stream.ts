const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export type CatalogImportProgressPhase =
  | 'parsing'
  | 'categories'
  | 'modifierGroups'
  | 'products'
  | 'done'
  | 'error';

export type CatalogImportProgress = {
  phase: CatalogImportProgressPhase;
  message?: string;
  current?: number;
  total?: number;
  percent?: number;
};

export type CatalogImportResult = {
  success: boolean;
  categoriesCreated?: number;
  productsCreated?: number;
  productsUpdated?: number;
  modifierGroupsCreated?: number;
  modifierGroupsUpdated?: number;
  errors?: Array<{ sheet: string; row: number; message: string }>;
};

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const locationId = localStorage.getItem('manupos_selected_location');
    if (locationId) headers['X-Location-Id'] = locationId;
  } catch {
    /* ignore */
  }
  return headers;
}

/** Excel catalog import with SSE progress from `/merchant/products/import/stream`. */
export async function importCatalogWithProgress(
  file: File,
  onProgress: (event: CatalogImportProgress) => void
): Promise<CatalogImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/merchant/products/import/stream`, {
    method: 'POST',
    body: formData,
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(String(err.error || 'Import failed'));
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Import failed — no response stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: CatalogImportResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = JSON.parse(line.slice(6)) as CatalogImportProgress & {
          result?: CatalogImportResult;
        };
        if (payload.phase === 'error') {
          throw new Error(payload.message || 'Import failed');
        }
        onProgress(payload);
        if (payload.phase === 'done' && payload.result) {
          finalResult = payload.result;
        }
      }
    }
  }

  if (!finalResult) throw new Error('Import did not complete');
  return finalResult;
}
