import type { RawInput, RefinedPrompt } from "../types.js";
import {
  normalize,
  splitSentences,
  extractMeaningfulWords,
  countWords,
  computeLanguageConfidence,
  deduplicate,
  truncate,
} from "../utils/text-normalizer.util.js";

const MAX_KEYWORD_COUNT  = 30;
const MIN_KEYWORD_LENGTH = 3;

function filterKeywords(words: readonly string[]): readonly string[] {
  return Object.freeze(
    deduplicate(words.filter(w => w.length >= MIN_KEYWORD_LENGTH)).slice(0, MAX_KEYWORD_COUNT)
  );
}

function repairSentenceCapitalization(sentences: readonly string[]): readonly string[] {
  return Object.freeze(
    sentences.map(s => {
      const trimmed = s.trim();
      if (trimmed.length === 0) return trimmed;
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    })
  );
}

export function refinePrompt(rawInput: RawInput): RefinedPrompt {
  const original          = rawInput.text;
  const normalized        = normalize(original);
  const rawSentences      = splitSentences(normalized);
  const sentences         = repairSentenceCapitalization(rawSentences);
  const wordCount         = countWords(normalized);
  const allWords          = extractMeaningfulWords(normalized);
  const cleanedKeywords   = filterKeywords(allWords);
  const languageConfidence = computeLanguageConfidence(normalized);

  return Object.freeze<RefinedPrompt>({
    original:          truncate(original, 1000),
    normalized,
    sentences,
    wordCount,
    cleanedKeywords,
    languageConfidence,
  });
}
