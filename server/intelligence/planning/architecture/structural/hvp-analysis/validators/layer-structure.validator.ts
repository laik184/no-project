import type {
  FileNode,
  LayerDefinition,
  Violation,
  ViolationType,
  ValidatorResult,
} from "../types.js";
import { buildLayerMap } from "../utils/layer-map.builder.util.js";

const VALIDATOR_NAME = "layer-structure";

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `lsv-${String(_idCounter).padStart(4, "0")}`;
}
export function resetLayerStructureCounter(): void { _idCounter = 0; }

function makeViolation(
  type:        ViolationType,
  file:        string,
  imported:    string,
  message:     string,
  rule:        string,
  evidence:    readonly string[],
  severity:    import("../types.js").ViolationSeverity = "HIGH",
): Violation {
  return Object.freeze({
    id:           nextId(),
    type,
    severity,
    file,
    importedFile: imported,
    message,
    rule,
    evidence:     Object.freeze([...evidence]),
  });
}

function validateRequiredLayers(
  definedLevels: readonly number[],
  definitions:   readonly LayerDefinition[],
): readonly Violation[] {
  const violations: Violation[] = [];
  for (const def of definitions) {
    if (!definedLevels.includes(def.level)) {
      violations.push(makeViolation(
        "MISSING_REQUIRED_LAYER",
        `layer-${def.level}`,
        "",
        `Required HVP layer ${def.level} (${def.name}) has no files assigned`,
        "Every defined HVP layer must contain at least one file",
        [`Expected layer level: ${def.level}`, `Layer name: ${def.name}`, `Required roles: ${def.roles.join(", ")}`],
        "CRITICAL",
      ));
    }
  }
  return Object.freeze(violations);
}

function validateFileLayerAssignment(
  files:       readonly FileNode[],
  definitions: readonly LayerDefinition[],
): readonly Violation[] {
  const violations: Violation[] = [];
  const definedLevels = new Set(definitions.map((d) => d.level));

  for (const file of files) {
    if (!definedLevels.has(file.layer)) {
      violations.push(makeViolation(
        "LAYER_STRUCTURE_INVALID",
        file.path,
        "",
        `File assigned to undefined layer ${file.layer}`,
        "Files must be assigned to a layer defined in LayerDefinitions",
        [`file: ${file.path}`, `assigned layer: ${file.layer}`, `defined layers: ${[...definedLevels].join(", ")}`],
        "HIGH",
      ));
      continue;
    }
    const def = definitions.find((d) => d.level === file.layer);
    if (def && !(def.roles as readonly string[]).includes(file.role)) {
      violations.push(makeViolation(
        "LAYER_STRUCTURE_INVALID",
        file.path,
        "",
        `File role '${file.role}' not permitted in layer ${file.layer} (${def.name})`,
        `Layer ${def.level} only permits roles: ${def.roles.join(", ")}`,
        [`file: ${file.path}`, `role: ${file.role}`, `layer: ${file.layer}`, `allowed roles: ${def.roles.join(", ")}`],
        "MEDIUM",
      ));
    }
  }
  return Object.freeze(violations);
}

export function validateLayerStructure(
  files:       readonly FileNode[],
  definitions: readonly LayerDefinition[],
  startMs:     number = Date.now(),
): ValidatorResult {
  const violations: Violation[] = [];

  if (!Array.isArray(files) || files.length === 0) {
    return Object.freeze({
      validatorName: VALIDATOR_NAME,
      violations:    Object.freeze([]),
      checkedFiles:  0,
      durationMs:    Date.now() - startMs,
    });
  }

  const layerMap = buildLayerMap(files);
  violations.push(...validateRequiredLayers(layerMap.definedLevels, definitions));
  violations.push(...validateFileLayerAssignment(files, definitions));

  return Object.freeze({
    validatorName: VALIDATOR_NAME,
    violations:    Object.freeze(violations),
    checkedFiles:  files.length,
    durationMs:    Date.now() - startMs,
  });
}
