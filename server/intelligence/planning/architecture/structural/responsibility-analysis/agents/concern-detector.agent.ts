import type {
  FileDescriptor,
  ConcernDetection,
} from "../types.js";
import { CONCERN_MIX_THRESHOLD }     from "../types.js";
import { extractConcernTags, uniqueTags } from "../utils/tag-extractor.util.js";

function analyzeFile(file: Readonly<FileDescriptor>): ConcernDetection {
  const evidence = extractConcernTags(
    file.path,
    file.exports,
    file.contentHint,
  );
  const concerns = uniqueTags(evidence);
  const isMixed  = concerns.length >= CONCERN_MIX_THRESHOLD;

  return Object.freeze({
    path:     file.path,
    concerns,
    evidence: Object.freeze([...evidence]),
    isMixed,
  });
}

export function detectConcerns(
  files: readonly FileDescriptor[],
): readonly ConcernDetection[] {
  if (!Array.isArray(files) || files.length === 0) {
    return Object.freeze<ConcernDetection[]>([]);
  }
  return Object.freeze(files.map(analyzeFile));
}

export function mixedFiles(
  detections: readonly ConcernDetection[],
): readonly ConcernDetection[] {
  return Object.freeze(detections.filter((d) => d.isMixed));
}

export function pureFiles(
  detections: readonly ConcernDetection[],
): readonly ConcernDetection[] {
  return Object.freeze(detections.filter((d) => !d.isMixed));
}

export function mostConcernedFile(
  detections: readonly ConcernDetection[],
): ConcernDetection | null {
  if (detections.length === 0) return null;
  return detections.reduce(
    (max, d) => (d.concerns.length > max.concerns.length ? d : max),
    detections[0]!,
  );
}
