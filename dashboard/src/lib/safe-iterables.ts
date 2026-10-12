/** Coerce unknown API / scanner payloads into an array. Never throws. */
export function asArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value instanceof Set) return [...value] as T[];
  if (value instanceof Map) return [...value.values()] as T[];
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as Iterable<T>)[Symbol.iterator] === 'function' &&
    typeof value !== 'string'
  ) {
    try {
      return Array.from(value as Iterable<T>);
    } catch {
      return [];
    }
  }
  return [];
}

/** String ids from a payload field that may be missing or a non-array. */
export function asStringArray(value: unknown): string[] {
  return asArray<unknown>(value)
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}
