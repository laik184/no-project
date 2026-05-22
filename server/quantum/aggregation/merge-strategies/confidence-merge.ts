/**
 * confidence-merge.ts
 *
 * Confidence merge strategy: for conflicting files, the agent with the
 * highest confidence score wins. When scores are within the tie threshold,
 * outputs are blended by appending non-duplicate sections.
 */

import type { AgentResult, MergedFileState } from "../aggregation-types.ts";

const TIE_THRESHOLD = 0.05;  // scores within 5% are considered tied

export interface ConfidenceMergeResult {
  mergedFiles: MergedFileState[];
  tiedFiles:   string[];
}

/**
 * Confidence-merge all file mutations.
 * Tied files receive a blended output; clear winners take the top-score content.
 */
export function confidenceMerge(results: AgentResult[]): ConfidenceMergeResult {
  const fileMap  = _buildFileMap(results);
  const merged:  MergedFileState[] = [];
  const tiedFiles: string[] = [];

  for (const [filePath, candidates] of fileMap) {
    if (candidates.length === 1) {
      const c = candidates[0];
      if (!c.content) continue;
      merged.push({
        filePath, content: c.content, strategy: "confidence",
        winnerId: c.nodeId, confidence: c.confidence, mergedAt: Date.now(),
      });
      continue;
    }

    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
    const top    = sorted[0];
    const runner = sorted[1];

    const tied = Math.abs(top.confidence - runner.confidence) <= TIE_THRESHOLD;

    if (tied && top.content && runner.content) {
      tiedFiles.push(filePath);
      const blended = _blendContent(top.content, runner.content);
      merged.push({
        filePath, content: blended, strategy: "confidence",
        winnerId: top.nodeId,
        confidence: (top.confidence + runner.confidence) / 2,
        mergedAt: Date.now(),
      });
    } else {
      if (!top.content) continue;
      merged.push({
        filePath, content: top.content, strategy: "confidence",
        winnerId: top.nodeId, confidence: top.confidence, mergedAt: Date.now(),
      });
    }
  }

  return { mergedFiles: merged, tiedFiles };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FileCandidate {
  nodeId:     string;
  content:    string | undefined;
  confidence: number;
}

function _buildFileMap(results: AgentResult[]): Map<string, FileCandidate[]> {
  const map = new Map<string, FileCandidate[]>();
  for (const result of results) {
    for (const mutation of result.fileMutations) {
      if (!map.has(mutation.filePath)) map.set(mutation.filePath, []);
      map.get(mutation.filePath)!.push({
        nodeId:     result.nodeId,
        content:    mutation.content,
        confidence: result.confidence,
      });
    }
  }
  return map;
}

/**
 * Naive content blend: take base and append unique lines from supplement.
 * Keeps the output deterministic and avoids duplication.
 */
function _blendContent(base: string, supplement: string): string {
  const baseLines = new Set(base.split("\n"));
  const extra = supplement
    .split("\n")
    .filter(line => line.trim() && !baseLines.has(line));
  if (extra.length === 0) return base;
  return `${base}\n// [confidence-merge: supplemental lines]\n${extra.join("\n")}`;
}
