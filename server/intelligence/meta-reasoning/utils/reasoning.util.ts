export function extractKeyPhrases(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const stopWords = new Set([
    "the", "a", "an", "is", "was", "to", "of", "and", "or", "in",
    "it", "that", "this", "with", "for", "on", "by", "as", "at", "be",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 10);
}

export function detectOutcomePolarity(outcome: string): "positive" | "negative" | "neutral" {
  const lower = outcome.toLowerCase();
  const negativeSignals = ["fail", "error", "wrong", "bad", "slow", "broken", "crash", "timeout", "reject", "block"];
  const positiveSignals = ["success", "pass", "correct", "fast", "good", "resolved", "complete", "done", "ok", "valid"];
  const negativeCount = negativeSignals.filter((s) => lower.includes(s)).length;
  const positiveCount = positiveSignals.filter((s) => lower.includes(s)).length;
  if (negativeCount > positiveCount) return "negative";
  if (positiveCount > negativeCount) return "positive";
  return "neutral";
}

export function scoreGoalAlignment(decision: string, context: string): number {
  const decisionPhrases = extractKeyPhrases(decision);
  const contextPhrases = extractKeyPhrases(context);
  if (decisionPhrases.length === 0 || contextPhrases.length === 0) return 0.5;
  const overlap = decisionPhrases.filter((p) => contextPhrases.includes(p)).length;
  const unionSize = new Set([...decisionPhrases, ...contextPhrases]).size;
  return unionSize === 0 ? 0.5 : Math.round((overlap / unionSize) * 1000) / 1000;
}

export function extractAssumptions(decision: string): string[] {
  const patterns: Array<[RegExp, string]> = [
    [/\bif\b/i, "Assumes a conditional state is true"],
    [/\bwhen\b/i, "Assumes timing or trigger condition"],
    [/\balways\b/i, "Assumes universal applicability"],
    [/\bnever\b/i, "Assumes absolute exclusion"],
    [/\bshould\b/i, "Assumes expected behavior"],
    [/\bwill\b/i, "Assumes future state certainty"],
    [/\bmust\b/i, "Assumes strict requirement holds"],
  ];
  const found: string[] = [];
  for (const [regex, label] of patterns) {
    if (regex.test(decision)) found.push(label);
  }
  return found.length > 0 ? found : ["Assumes context remains stable during execution"];
}

export function inferLogicPath(decision: string, context: string): string[] {
  const path: string[] = [];
  path.push(`Parse intent from: "${decision.slice(0, 60)}${decision.length > 60 ? "..." : ""}"`);
  if (context.length > 0) path.push(`Apply context constraints: "${context.slice(0, 50)}${context.length > 50 ? "..." : ""}"`);
  path.push("Evaluate available strategies against constraints");
  path.push("Select highest-weighted option");
  path.push("Execute and observe outcome");
  return path;
}
