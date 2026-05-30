/**
 * server/memory/compression/summarizer.ts
 *
 * Purpose: Produce condensed text summaries from collections of memory entries.
 * Responsibility: Extract key sentences; reduce token footprint for context windows.
 *   No LLM calls — uses extractive summarisation (ranked sentence selection).
 * Exports: Summarizer, summarizer (singleton)
 */

import type { MemoryEntry } from '../types/memory.types.ts';

// ── Sentence scoring ──────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

function termFreq(sentence: string): Map<string, number> {
  const tf = new Map<string, number>();
  const tokens = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  for (const t of tokens) {
    if (t.length > 2) tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  return tf;
}

function scoreSentence(sentence: string, globalTf: Map<string, number>): number {
  const tf     = termFreq(sentence);
  let score    = 0;
  for (const [term, count] of tf) {
    score += count * (globalTf.get(term) ?? 0);
  }
  return score / Math.max(1, sentence.split(' ').length);
}

// ── Summarizer ────────────────────────────────────────────────────────────────

export interface SummaryResult {
  summary:    string;
  tokensSaved: number;
  entryCount:  number;
}

export class Summarizer {

  /**
   * Summarise a list of entries into a compact text block.
   * Uses extractive approach: selects highest-scoring sentences.
   */
  summarise(entries: MemoryEntry[], targetSentences = 5): SummaryResult {
    const fullText = entries.map(e => e.content).join(' ');
    const sentences = splitSentences(fullText);

    if (sentences.length <= targetSentences) {
      return {
        summary:     fullText.slice(0, 1000),
        tokensSaved: 0,
        entryCount:  entries.length,
      };
    }

    // Build global term frequency
    const globalTf = new Map<string, number>();
    for (const s of sentences) {
      for (const [t, c] of termFreq(s)) {
        globalTf.set(t, (globalTf.get(t) ?? 0) + c);
      }
    }

    // Score and select top sentences, preserving order
    const scored = sentences.map((s, i) => ({
      sentence: s,
      score:    scoreSentence(s, globalTf),
      index:    i,
    }));

    const top = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, targetSentences)
      .sort((a, b) => a.index - b.index)
      .map(s => s.sentence);

    const summary    = top.join(' ');
    const tokensSaved = fullText.split(' ').length - summary.split(' ').length;

    return { summary, tokensSaved, entryCount: entries.length };
  }

  /** Summarise a single entry's content. */
  summariseOne(entry: MemoryEntry, targetSentences = 3): string {
    return this.summarise([entry], targetSentences).summary;
  }
}

export const summarizer = new Summarizer();
