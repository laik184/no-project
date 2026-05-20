import type {
  FileNode,
  LayerDefinition,
  Violation,
  ViolationType,
  ViolationSeverity,
  ValidatorResult,
  FileRole,
} from "../types.js";
import { buildImportGraph } from "../utils/import-graph.builder.util.js";
import type { ImportEdge }  from "../types.js";

const VALIDATOR_NAME = "cross-layer";

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `clv-${String(_idCounter).padStart(4, "0")}`;
}
export function resetCrossLayerCounter(): void { _idCounter = 0; }

const ROLE_VIOLATION_MAP: Partial<
  Record<FileRole, Partial<Record<FileRole, { type: ViolationType; severity: ViolationSeverity; rule: string }>>>
> = {
  validator: {
    validator: {
      type:     "VALIDATOR_IMPORTS_VALIDATOR",
      severity: "CRITICAL",
      rule:     "Validators must not import each other — only orchestrators may import validators",
    },
  },
  state: {
    validator: {
      type:     "STATE_IMPORTS_VALIDATOR",
      severity: "CRITICAL",
      rule:     "state.ts must not import any validator — it may only import types",
    },
    util: {
      type:     "STATE_IMPORTS_UTIL",
      severity: "HIGH",
      rule:     "state.ts must not import utils — it should be self-contained with types only",
    },
  },
  util: {
    validator: {
      type:     "UTIL_IMPORTS_VALIDATOR",
      severity: "HIGH",
      rule:     "Utils are leaf nodes and must not import validators",
    },
  },
};

function makeViolation(
  edge:     Readonly<ImportEdge>,
  type:     ViolationType,
  severity: ViolationSeverity,
  rule:     string,
): Violation {
  return Object.freeze({
    id:           nextId(),
    type,
    severity,
    file:         edge.from,
    importedFile: edge.to,
    message:      `Forbidden cross-layer import: ${edge.fromRole} '${edge.from}' imports ${edge.toRole} '${edge.to}'`,
    rule,
    evidence:     Object.freeze([
      `importer: ${edge.from} (role: ${edge.fromRole})`,
      `imported: ${edge.to}  (role: ${edge.toRole})`,
      `violation: ${type}`,
    ]),
  });
}

function checkEdgeForRoleViolation(
  edge: Readonly<ImportEdge>,
): Violation | null {
  const fromMap = ROLE_VIOLATION_MAP[edge.fromRole];
  if (!fromMap) return null;
  const spec = fromMap[edge.toRole];
  if (!spec) return null;
  return makeViolation(edge, spec.type, spec.severity, spec.rule);
}

export function validateCrossLayerImports(
  files:       readonly FileNode[],
  definitions: readonly LayerDefinition[],
  startMs:     number = Date.now(),
): ValidatorResult {
  if (!Array.isArray(files) || files.length === 0) {
    return Object.freeze({
      validatorName: VALIDATOR_NAME,
      violations:    Object.freeze([]),
      checkedFiles:  0,
      durationMs:    Date.now() - startMs,
    });
  }

  const graph      = buildImportGraph(files, definitions);
  const violations: Violation[] = [];

  for (const edge of graph.edges) {
    const v = checkEdgeForRoleViolation(edge);
    if (v) violations.push(v);
  }

  return Object.freeze({
    validatorName: VALIDATOR_NAME,
    violations:    Object.freeze(violations),
    checkedFiles:  files.length,
    durationMs:    Date.now() - startMs,
  });
}

export function detectType(violationType: ViolationType): ViolationSeverity {
  switch (violationType) {
    case "VALIDATOR_IMPORTS_VALIDATOR":
    case "STATE_IMPORTS_VALIDATOR":     return "CRITICAL";
    case "STATE_IMPORTS_UTIL":
    case "UTIL_IMPORTS_VALIDATOR":      return "HIGH";
    default:                            return "MEDIUM";
  }
}
