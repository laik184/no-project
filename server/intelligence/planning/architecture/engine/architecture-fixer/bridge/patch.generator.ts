let _seq = 0;

export function resetPatchGeneratorState(): void {
  _seq = 0;
}

export type Patch = {
  readonly id: string;
  readonly filePath: string;
  readonly patch: string;
};

export function generatePatches(violations: readonly unknown[]): readonly Patch[] {
  return Object.freeze(
    violations.map((_, i) => Object.freeze({
      id: `patch-${++_seq}-${i}`,
      filePath: 'unknown',
      patch: '',
    })),
  );
}
