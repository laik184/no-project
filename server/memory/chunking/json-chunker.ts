/**
 * server/memory/chunking/json-chunker.ts
 * Safely chunk large JSON objects or arrays into string segments.
 */

export interface JsonChunkOptions {
  chunkSize?: number;
}

export function chunkJson(input: unknown, opts: JsonChunkOptions = {}): string[] {
  const size = opts.chunkSize ?? 20;

  if (input === null || input === undefined) return ['null'];
  if (typeof input !== 'object') return [JSON.stringify(input)];

  if (Array.isArray(input)) {
    const chunks: string[] = [];
    for (let i = 0; i < input.length; i += size) {
      chunks.push(JSON.stringify(input.slice(i, i + size)));
    }
    return chunks.length > 0 ? chunks : ['[]'];
  }

  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return ['{}'];

  const chunks: string[] = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(JSON.stringify(Object.fromEntries(entries.slice(i, i + size))));
  }
  return chunks;
}
