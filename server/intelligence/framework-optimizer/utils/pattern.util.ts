export function hasItems(value: readonly string[] | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function asList(value: readonly string[] | undefined): readonly string[] {
  return Array.isArray(value) ? value : Object.freeze([]);
}
