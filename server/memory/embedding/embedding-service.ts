/**
 * server/memory/embedding/embedding-service.ts
 * LRU-capped caching layer over an EmbeddingProvider.
 */

import { defaultEmbeddingProvider, type EmbeddingProvider } from './embedding-provider.ts';

const CACHE_MAX = 2048;

export class EmbeddingService {
  private readonly cache = new Map<string, number[]>();

  constructor(private readonly provider: EmbeddingProvider = defaultEmbeddingProvider) {}

  async embed(text: string): Promise<number[]> {
    const key = text.slice(0, 200);
    const hit  = this.cache.get(key);
    if (hit) return hit;

    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }

    const vec = await this.provider.generateEmbedding(text);
    this.cache.set(key, vec);
    return vec;
  }

  flush(): void {
    this.cache.clear();
  }
}

export const embeddingService = new EmbeddingService();
