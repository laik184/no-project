import type {
  FileDescriptor,
  ConcernDetection,
  ResponsibilityViolation,
  SRPViolationType,
  ViolationSeverity,
} from "../types.js";
import { LINE_COUNT_THRESHOLD } from "../types.js";
import { computeFileMetrics }   from "../utils/file-metrics.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `rsp-${String(_counter).padStart(4, "0")}`;
}
export function resetMultiDetectorCounter(): void { _counter = 0; }

function makeViolation(
  type:     SRPViolationType,
  severity: ViolationSeverity,
  file:     string,
  concerns: readonly import("../types.js").ConcernTag[],
  message:  string,
  rule:     string,
  evidence: readonly string[],
): ResponsibilityViolation {
  return Object.freeze({
    id: nextId(), type, severity, file, concerns,
    message, rule, evidence: Object.freeze([...evidence]),
  });
}

function detectMixedConcerns(
  detection: Readonly<ConcernDetection>,
): ResponsibilityViolation | null {
  if (!detection.isMixed) return null;
  const tags = detection.concerns.join(", ");
  return makeViolation(
    "MIXED_CONCERNS",
    detection.concerns.length >= 4 ? "CRITICAL" : "HIGH",
    detection.path,
    detection.concerns,
    `File mixes ${detection.concerns.length} responsibilities: ${tags}`,
    "One file should have one primary concern (Single Responsibility Principle)",
    detection.evidence.map((e) => `${e.tag} detected via ${e.source}: "${e.matched}"`),
  );
}

function detectOversizedFile(
  file: Readonly<FileDescriptor>,
): ResponsibilityViolation | null {
  if (file.lineCount <= LINE_COUNT_THRESHOLD) return null;
  const excess = file.lineCount - LINE_COUNT_THRESHOLD;
  return makeViolation(
    "FILE_TOO_LARGE",
    file.lineCount > LINE_COUNT_THRESHOLD * 2 ? "CRITICAL" : "MEDIUM",
    file.path,
    Object.freeze([]),
    `File has ${file.lineCount} lines (${excess} over ${LINE_COUNT_THRESHOLD}-line threshold)`,
    `Files must not exceed ${LINE_COUNT_THRESHOLD} lines — split into focused modules`,
    [
      `lineCount: ${file.lineCount}`,
      `threshold: ${LINE_COUNT_THRESHOLD}`,
      `excess: ${excess} lines`,
    ],
  );
}

function detectOrchestratorDoingLogic(
  file:      Readonly<FileDescriptor>,
  detection: Readonly<ConcernDetection>,
): ResponsibilityViolation | null {
  if (file.role !== "orchestrator") return null;
  const businessTags = detection.concerns.filter(
    (c) => c === "DATABASE" || c === "FILESYSTEM" || c === "BUSINESS_LOGIC" || c === "HTTP",
  );
  if (businessTags.length === 0) return null;
  return makeViolation(
    "ORCHESTRATOR_DOING_LOGIC",
    "HIGH",
    file.path,
    businessTags,
    `Orchestrator contains business logic: ${businessTags.join(", ")}`,
    "Orchestrators must only coordinate — no database, HTTP, filesystem, or business logic",
    businessTags.map((t) => `found concern: ${t}`),
  );
}

function detectUtilWithBusinessLogic(
  file:      Readonly<FileDescriptor>,
  detection: Readonly<ConcernDetection>,
): ResponsibilityViolation | null {
  if (file.role !== "util") return null;
  const businessTags = detection.concerns.filter(
    (c) => c === "DATABASE" || c === "HTTP" || c === "AUTHENTICATION" || c === "BUSINESS_LOGIC",
  );
  if (businessTags.length === 0) return null;
  return makeViolation(
    "UTIL_WITH_BUSINESS_LOGIC",
    "MEDIUM",
    file.path,
    businessTags,
    `Util file contains business logic: ${businessTags.join(", ")}`,
    "Util files must be pure functions — no side effects or business logic",
    businessTags.map((t) => `found concern: ${t}`),
  );
}

export function detectMultipleResponsibilities(
  files:      readonly FileDescriptor[],
  detections: readonly ConcernDetection[],
): readonly ResponsibilityViolation[] {
  if (!Array.isArray(files) || files.length === 0) {
    return Object.freeze<ResponsibilityViolation[]>([]);
  }

  const violations: ResponsibilityViolation[] = [];
  const detectionMap = new Map(detections.map((d) => [d.path, d]));

  for (const file of files) {
    const detection = detectionMap.get(file.path);
    if (!detection) continue;

    const v1 = detectMixedConcerns(detection);
    if (v1) violations.push(v1);

    const v2 = detectOversizedFile(file);
    if (v2) violations.push(v2);

    const v3 = detectOrchestratorDoingLogic(file, detection);
    if (v3) violations.push(v3);

    const v4 = detectUtilWithBusinessLogic(file, detection);
    if (v4) violations.push(v4);
  }

  return Object.freeze(violations);
}
