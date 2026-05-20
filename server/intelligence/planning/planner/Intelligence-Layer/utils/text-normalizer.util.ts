const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "i", "we", "you",
  "it", "this", "that", "they", "them", "there", "here", "then", "so",
  "also", "just", "very", "too", "about", "up", "out", "into",
]);

const NOISE_PATTERN      = /[^a-zA-Z0-9\s\-.,!?:;'"()]/g;
const WHITESPACE_PATTERN = /\s{2,}/g;
const SENTENCE_PATTERN   = /[.!?]+/;

export function normalize(text: string): string {
  return text
    .trim()
    .replace(NOISE_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

export function splitSentences(text: string): readonly string[] {
  const parts = text
    .split(SENTENCE_PATTERN)
    .map(s => s.trim())
    .filter(s => s.length > 2);
  return Object.freeze(parts);
}

export function tokenize(text: string): readonly string[] {
  return Object.freeze(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 2)
  );
}

export function removeStopWords(words: readonly string[]): readonly string[] {
  return Object.freeze(words.filter(w => !STOP_WORDS.has(w)));
}

export function extractMeaningfulWords(text: string): readonly string[] {
  const tokens = tokenize(text);
  return removeStopWords(tokens);
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export function computeLanguageConfidence(text: string): number {
  const words       = tokenize(text);
  const meaningful  = removeStopWords(words);
  if (words.length === 0) return 0;
  const ratio       = meaningful.length / words.length;
  const lengthBonus = Math.min(words.length / 20, 0.3);
  return Math.round(Math.min(1, ratio * 0.7 + lengthBonus) * 100) / 100;
}

export function deduplicate(items: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(items)]);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
