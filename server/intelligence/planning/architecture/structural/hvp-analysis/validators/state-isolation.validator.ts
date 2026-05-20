import type {
  FileNode,
  LayerDefinition,
  Violation,
  ValidatorResult,
} from "../types.js";
import { buildLayerMap } from "../utils/layer-map.builder.util.js";
import { buildImportGraph } from "../utils/import-graph.builder.util.js";
import type { ImportEdge } from "../types.js";

const VALIDATOR_NAME = "state-isolation";

const STATE_FILE_PATTERNS = /(?:^|\/)state\.[jt]s$|(?:^|\/)state\/index\.[jt]s$/;
const ALLOWED_STATE_IMPORTS = new Set<string>(["type", "types", "unknown"]);

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `siv-${String(_idCounter).padStart(4, "0")}`;
}
export function resetStateIsolationCounter(): void { _idCounter = 0; }

function isStateFile(path: string, role: string): boolean {
  return role === "state" || STATE_FILE_PATTERNS.test(path);
}

function stateMutationViolation(edge: Readonly<ImportEdge>): Violation {
  return Object.freeze({
    id:           nextId(),
    type:         "STATE_MUTATION_OUTSIDE_ORCHESTRATOR" as const,
    severity:     "CRITICAL" as const,
    file:         edge.from,
    importedFile: edge.to,
    message:      `State access violation: non-orchestrator '${edge.from}' (role: ${edge.fromRole}) imports state '${edge.to}'`,
    rule:         "Only orchestrators may import state. Validators, agents, and utils must not access state directly.",
    evidence:     Object.freeze([
      `importer: ${edge.from} (role: ${edge.fromRole})`,
      `state file: ${edge.to}`,
      `fix: route state access through the orchestrator`,
    ]),
  });
}

function stateImportsAgentViolation(edge: Readonly<ImportEdge>): Violation {
  return Object.freeze({
    id:           nextId(),
    type:         "STATE_IMPORTS_VALIDATOR" as const,
    severity:     "CRITICAL" as const,
    file:         edge.from,
    importedFile: edge.to,
    message:      `State isolation breach: state file '${edge.from}' imports '${edge.to}' (role: ${edge.toRole})`,
    rule:         "state.ts must only import from types. No validators, agents, services, or utils.",
    evidence:     Object.freeze([
      `state file: ${edge.from}`,
      `imported: ${edge.to} (role: ${edge.toRole})`,
      `allowed imports: type files only`,
    ]),
  });
}

export function validateStateIsolation(
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

  const orchestratorPaths = new Set(
    files
      .filter((f) => f.role === "orchestrator" || f.role === "index")
      .map((f) => f.path),
  );

  for (const edge of graph.edges) {
    const toIsState   = isStateFile(edge.to,   edge.toRole);
    const fromIsState = isStateFile(edge.from, edge.fromRole);

    if (toIsState && !orchestratorPaths.has(edge.from)) {
      violations.push(stateMutationViolation(edge));
      continue;
    }

    if (fromIsState && !ALLOWED_STATE_IMPORTS.has(edge.toRole)) {
      violations.push(stateImportsAgentViolation(edge));
    }
  }

  return Object.freeze({
    validatorName: VALIDATOR_NAME,
    violations:    Object.freeze(violations),
    checkedFiles:  files.length,
    durationMs:    Date.now() - startMs,
  });
}
