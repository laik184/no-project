import type {
  ImportEdge,
  FileNode,
  LayerDefinition,
  Violation,
  ValidatorResult,
} from "../types.js";
import { buildImportGraph, filterViolatingEdges } from "../utils/import-graph.builder.util.js";

const VALIDATOR_NAME = "import-direction";

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `idv-${String(_idCounter).padStart(4, "0")}`;
}
export function resetImportDirectionCounter(): void { _idCounter = 0; }

function makeViolation(
  edge:    Readonly<ImportEdge>,
  message: string,
  rule:    string,
): Violation {
  return Object.freeze({
    id:           nextId(),
    type:         "IMPORT_DIRECTION_REVERSED" as const,
    severity:     "CRITICAL" as const,
    file:         edge.from,
    importedFile: edge.to,
    message,
    rule,
    evidence:     Object.freeze([
      `from: ${edge.from} (layer ${edge.fromLayer}, role: ${edge.fromRole})`,
      `to:   ${edge.to} (layer ${edge.toLayer}, role: ${edge.toRole})`,
      `direction: layer ${edge.fromLayer} → layer ${edge.toLayer} is FORBIDDEN`,
    ]),
  });
}

function describeDirection(edge: Readonly<ImportEdge>): string {
  if (edge.fromLayer < edge.toLayer) {
    return `upward (layer ${edge.fromLayer} → layer ${edge.toLayer}) — allowed`;
  }
  if (edge.fromLayer > edge.toLayer) {
    return `downward (layer ${edge.fromLayer} → layer ${edge.toLayer}) — FORBIDDEN`;
  }
  return `same-layer (layer ${edge.fromLayer} → layer ${edge.toLayer})`;
}

export function validateImportDirection(
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

  const graph    = buildImportGraph(files, definitions);
  const badEdges = filterViolatingEdges(graph.edges);

  const violations: Violation[] = badEdges
    .filter((e) => e.fromLayer !== e.toLayer)
    .map((e) =>
      makeViolation(
        e,
        `Reversed import: ${e.from} (layer ${e.fromLayer}) imports ${e.to} (layer ${e.toLayer}). ${describeDirection(e)}`,
        `Layer ${e.fromLayer} may not import from layer ${e.toLayer} — imports must flow downward (higher layer → lower layer number)`,
      ),
    );

  return Object.freeze({
    validatorName: VALIDATOR_NAME,
    violations:    Object.freeze(violations),
    checkedFiles:  files.length,
    durationMs:    Date.now() - startMs,
  });
}
