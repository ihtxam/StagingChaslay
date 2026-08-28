/** Delete many items sequentially; returns success and failure counts. */
export async function bulkDeleteByIds(
  ids: string[],
  deleteOne: (id: string) => Promise<void>
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await deleteOne(id);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  return { ok, failed };
}
