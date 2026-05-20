export interface LineAccumulator {
  readonly lines: readonly string[];
  readonly remainder: string;
}

export function parseStreamChunk(
  existingRemainder: string,
  chunk: Buffer,
): Readonly<LineAccumulator> {
  const combined = `${existingRemainder}${chunk.toString("utf8")}`;
  const split = combined.split(/\r?\n/);
  const remainder = split.pop() ?? "";

  return Object.freeze({
    lines: Object.freeze(split.filter((line) => line.length > 0)),
    remainder,
  });
}
