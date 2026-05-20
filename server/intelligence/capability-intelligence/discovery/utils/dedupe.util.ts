export function dedupeById<T extends { readonly id: string }>(
  items: readonly T[],
): readonly T[] {
  if (!Array.isArray(items)) return Object.freeze([]);
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return Object.freeze(result);
}

export function dedupeByName<T extends { readonly name: string }>(
  items: readonly T[],
): readonly T[] {
  if (!Array.isArray(items)) return Object.freeze([]);
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return Object.freeze(result);
}

export function dedupeByIdAndName<T extends { readonly id: string; readonly name: string }>(
  items: readonly T[],
): readonly T[] {
  if (!Array.isArray(items)) return Object.freeze([]);
  const seenIds   = new Set<string>();
  const seenNames = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const nameKey = item.name.toLowerCase().trim();
    if (!seenIds.has(item.id) && !seenNames.has(nameKey)) {
      seenIds.add(item.id);
      seenNames.add(nameKey);
      result.push(item);
    }
  }
  return Object.freeze(result);
}

export function dedupeStrings(items: readonly string[]): readonly string[] {
  if (!Array.isArray(items)) return Object.freeze([]);
  return Object.freeze([...new Set(items)]);
}

export function hasId(
  items: ReadonlyArray<{ readonly id: string }>,
  id: string,
): boolean {
  return items.some((i) => i.id === id);
}
