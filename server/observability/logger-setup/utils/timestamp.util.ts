export function nowIso(): string {
  return new Date().toISOString();
}

export function epochMs(): number {
  return Date.now();
}
