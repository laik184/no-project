import type {
  FileDescriptor,
  ConcernDetection,
  PurityScore,
  ConcernTag,
} from "../types.js";
import { CONCERN_MIX_THRESHOLD } from "../types.js";

const ROLE_ALLOWED_CONCERNS = Object.freeze<Partial<Record<FileDescriptor["role"], readonly ConcernTag[]>>>({
  orchestrator: Object.freeze(["ORCHESTRATION"]),
  util:         Object.freeze(["TRANSFORMATION", "CONFIGURATION", "UNKNOWN"]),
  state:        Object.freeze(["STATE_MANAGEMENT", "CONFIGURATION", "UNKNOWN"]),
  type:         Object.freeze(["UNKNOWN"]),
  index:        Object.freeze(["ORCHESTRATION", "UNKNOWN"]),
  agent:        Object.freeze([
    "BUSINESS_LOGIC", "VALIDATION", "TRANSFORMATION",
    "DATABASE", "HTTP", "AUTHENTICATION", "CACHING",
    "SCHEDULING", "MESSAGING", "RENDERING", "LOGGING",
    "STATE_MANAGEMENT", "CONFIGURATION", "UNKNOWN",
  ]),
  service:      Object.freeze([
    "BUSINESS_LOGIC", "DATABASE", "HTTP", "VALIDATION",
    "AUTHENTICATION", "CACHING", "TRANSFORMATION", "UNKNOWN",
  ]),
});

function mixReason(
  role:        FileDescriptor["role"],
  concerns:    readonly ConcernTag[],
  isMixedCount: boolean,
): string {
  const allowed = ROLE_ALLOWED_CONCERNS[role];
  if (!allowed) {
    return concerns.length >= CONCERN_MIX_THRESHOLD
      ? `Unknown role with ${concerns.length} concerns: ${concerns.join(", ")}`
      : "No mix detected";
  }
  const forbidden = concerns.filter((c) => !(allowed as readonly string[]).includes(c));
  if (forbidden.length > 0) {
    return `Role '${role}' should not handle: ${forbidden.join(", ")}`;
  }
  if (isMixedCount) {
    return `File mixes ${concerns.length} concerns for role '${role}'`;
  }
  return "No mix detected";
}

function computePurity(
  file:      Readonly<FileDescriptor>,
  detection: Readonly<ConcernDetection>,
): PurityScore {
  const allowed      = ROLE_ALLOWED_CONCERNS[file.role];
  const isMixedCount = detection.concerns.length >= CONCERN_MIX_THRESHOLD;
  const forbidden    = allowed
    ? detection.concerns.filter((c) => !(allowed as readonly string[]).includes(c))
    : detection.concerns;

  const isMixed   = isMixedCount || forbidden.length > 0;
  const reason    = mixReason(file.role, detection.concerns, isMixedCount);

  const penalty   = (forbidden.length * 15) + (Math.max(0, detection.concerns.length - 1) * 8);
  const score     = Math.max(0, 100 - penalty);

  return Object.freeze({
    path:        file.path,
    purityScore: score,
    concerns:    detection.concerns,
    isMixed,
    mixReason:   reason,
  });
}

export function evaluatePurity(
  files:      readonly FileDescriptor[],
  detections: readonly ConcernDetection[],
): readonly PurityScore[] {
  if (!Array.isArray(files) || files.length === 0) {
    return Object.freeze<PurityScore[]>([]);
  }

  const detectionMap = new Map(detections.map((d) => [d.path, d]));

  const scores = files.map((file) => {
    const detection = detectionMap.get(file.path);
    if (!detection) {
      return Object.freeze({
        path:        file.path,
        purityScore: 100,
        concerns:    Object.freeze<ConcernTag[]>([]),
        isMixed:     false,
        mixReason:   "No concerns detected — pure",
      });
    }
    return computePurity(file, detection);
  });

  return Object.freeze(scores);
}

export function modulePurityScore(scores: readonly PurityScore[]): number {
  if (scores.length === 0) return 100;
  const total = scores.reduce((s, p) => s + p.purityScore, 0);
  return Math.round(total / scores.length);
}

export function impureFiles(
  scores: readonly PurityScore[],
): readonly PurityScore[] {
  return Object.freeze(scores.filter((s) => s.isMixed));
}
