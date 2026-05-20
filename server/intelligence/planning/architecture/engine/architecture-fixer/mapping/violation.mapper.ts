let _callCount = 0;

export function resetViolationMapperState(): void {
  _callCount = 0;
}

export function mapViolation(raw: unknown): unknown {
  _callCount += 1;
  return raw;
}

export function mapViolations(raws: readonly unknown[]): readonly unknown[] {
  return Object.freeze(raws.map(mapViolation));
}
