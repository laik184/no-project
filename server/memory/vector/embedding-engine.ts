/**
 * embedding-engine.ts
 *
 * Generates vector embeddings for memory entries using OpenRouter.
 * Falls back to a deterministic hash-based embedding if the API is unavailable.
 */

import { EMBEDDING_MODEL, EMBEDDING_DIM } from "./vector-types.ts";
import type { EmbeddingResult } from "./vector-types.ts";

const BASE_URL = process.env.LLM_BASE_URL
  ?? process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL
  ?? "https://openrouter.ai/api/v1";

const API_KEY = () =>
  process.env.OPENROUTER_API_KEY ?? process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ?? "";

// ── Deterministic fallback embedding ─────────────────────────────────────────

function hashEmbedding(text: string): number[] {
  const vec = new Array(EMBEDDING_DIM).fill(0) as number[];
  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    let h = 5381;
    for (let i = 0; i < word.length; i++) {
      h = ((h << 5) + h) + word.charCodeAt(i);
      h = h & h;  // Convert to 32-bit integer
    }
    const idx = Math.abs(h) % EMBEDDING_DIM;
    vec[idx] += 1;
    vec[(idx + 1) % EMBEDDING_DIM] += 0.5;
    vec[(idx + EMBEDDING_DIM - 1) % EMBEDDING_DIM] += 0.5;
  }

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? vec.map(v => v / norm) : vec;
}

// ── API embedding ──────────────────────────────────────────────────────────────

async function apiEmbedding(text: string): Promise<{ embedding: number[]; tokens: number }> {
  const key = API_KEY();
  if (!key) throw new Error("No API key for embeddings");

  const res = await fetch(`${BASE_URL}/embeddings`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8_000),  // max input
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Embeddings API HTTP ${res.status}`);
  }

  const json = await res.json() as {
    data?: Array<{ embedding: number[] }>;
    usage?: { total_tokens: number };
    error?: { message: string };
  };

  if (json.error) throw new Error(json.error.message);

  const embedding = json.data?.[0]?.embedding;
  if (!embedding?.length) throw new Error("Empty embedding response");

  return {
    embedding,
    tokens: json.usage?.total_tokens ?? Math.ceil(text.length / 4),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const normalized = text.trim().replace(/\s+/g, " ").slice(0, 8_000);

  try {
    const { embedding, tokens } = await apiEmbedding(normalized);
    return { content: normalized, embedding, tokens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[embedding-engine] API unavailable (${msg}) — using hash embedding`);
    return {
      content:   normalized,
      embedding: hashEmbedding(normalized),
      tokens:    Math.ceil(normalized.length / 4),
    };
  }
}

/** Batch embed multiple texts. Processes sequentially to avoid rate limits. */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
    // Small delay to respect rate limits
    if (texts.length > 1) await new Promise(r => setTimeout(r, 50));
  }
  return results;
}

/** Cosine similarity between two L2-normalized vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}
