import type { RefinedPrompt, ExtractedIntent, IntentType } from "../types.js";
import {
  detectIntentType,
  detectAllIntents,
  extractActionPhrases,
  detectDomain,
  detectScope,
} from "../utils/semantic-parser.util.js";
import { normalizeScore } from "../utils/confidence-calculator.util.js";

const SECONDARY_INTENT_LIMIT = 4;

function computeIntentConfidence(
  primaryIntent:    IntentType,
  actionPhraseCount: number,
  keywordCount:     number,
): number {
  const hasClearVerb   = actionPhraseCount > 0 ? 0.5 : 0.2;
  const keywordDensity = Math.min(keywordCount / 15, 0.4);
  const intentBonus    = primaryIntent !== "CREATE" ? 0.1 : 0;
  return normalizeScore(hasClearVerb + keywordDensity + intentBonus);
}

function filterSecondaryIntents(
  all:     readonly IntentType[],
  primary: IntentType,
): readonly IntentType[] {
  return Object.freeze(
    all
      .filter(i => i !== primary)
      .slice(0, SECONDARY_INTENT_LIMIT)
  );
}

export function extractIntent(refined: RefinedPrompt): ExtractedIntent {
  const fullText        = refined.normalized;
  const primaryIntent   = detectIntentType(fullText);
  const allIntents      = detectAllIntents(fullText);
  const secondaryIntents = filterSecondaryIntents(allIntents, primaryIntent);
  const actionPhrases   = extractActionPhrases(fullText);
  const domain          = detectDomain(refined.cleanedKeywords);
  const scope           = detectScope(refined.cleanedKeywords);
  const confidence      = computeIntentConfidence(
    primaryIntent,
    actionPhrases.length,
    refined.cleanedKeywords.length,
  );

  return Object.freeze<ExtractedIntent>({
    primaryIntent,
    secondaryIntents,
    actionPhrases,
    domain,
    scope,
    confidence,
  });
}
