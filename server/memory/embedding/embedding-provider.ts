/**
 * server/memory/embedding/embedding-provider.ts
 *
 * EmbeddingProvider interface + default hash-based TF implementation.
 * Produces 128-dim normalised vectors — no external API required.
 */

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

const DIM = 128;

function hashWord(word: string): number {
  let h = 5381;
  for (let i = 0; i < word.length; i++) {
    h = ((h << 5) + h) ^ word.charCodeAt(i);
    h = h >>> 0;
  }
  return h % DIM;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

export class HashEmbeddingProvider implements EmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    const tokens = tokenize(text);
    const vec    = new Array<number>(DIM).fill(0);

    for (const token of tokens) {
      vec[hashWord(token)] += 1;
    }

    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }
}

export const defaultEmbeddingProvider: EmbeddingProvider = new HashEmbeddingProvider();
