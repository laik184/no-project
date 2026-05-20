import type {
  FileNode,
  LayerDefinition,
  FileRole,
} from "../types.js";

export interface LayerMap {
  readonly byLevel:      Readonly<Record<number, readonly FileNode[]>>;
  readonly byPath:       Readonly<Record<string, FileNode>>;
  readonly byRole:       Readonly<Record<FileRole, readonly FileNode[]>>;
  readonly definedLevels: readonly number[];
}

export interface LayerLookup {
  readonly levelByPath:  Readonly<Record<string, number>>;
  readonly roleByPath:   Readonly<Record<string, FileRole>>;
}

function groupByLevel(files: readonly FileNode[]): Record<number, FileNode[]> {
  const map: Record<number, FileNode[]> = {};
  for (const f of files) {
    if (!map[f.layer]) map[f.layer] = [];
    map[f.layer]!.push(f);
  }
  return map;
}

function groupByRole(files: readonly FileNode[]): Record<FileRole, FileNode[]> {
  const map: Partial<Record<FileRole, FileNode[]>> = {};
  for (const f of files) {
    if (!map[f.role]) map[f.role] = [];
    map[f.role]!.push(f);
  }
  return map as Record<FileRole, FileNode[]>;
}

export function buildLayerMap(files: readonly FileNode[]): LayerMap {
  if (!Array.isArray(files) || files.length === 0) {
    return Object.freeze({
      byLevel:       Object.freeze({}),
      byPath:        Object.freeze({}),
      byRole:        Object.freeze({} as Record<FileRole, readonly FileNode[]>),
      definedLevels: Object.freeze([]),
    });
  }

  const byLevel = groupByLevel(files);
  const byRole  = groupByRole(files);
  const byPath  = Object.fromEntries(files.map((f) => [f.path, f]));

  const frozenByLevel = Object.freeze(
    Object.fromEntries(
      Object.entries(byLevel).map(([k, v]) => [k, Object.freeze(v)]),
    ),
  );
  const frozenByRole = Object.freeze(
    Object.fromEntries(
      Object.entries(byRole).map(([k, v]) => [k, Object.freeze(v)]),
    ),
  ) as Record<FileRole, readonly FileNode[]>;

  return Object.freeze({
    byLevel:       frozenByLevel,
    byPath:        Object.freeze(byPath),
    byRole:        frozenByRole,
    definedLevels: Object.freeze(Object.keys(byLevel).map(Number).sort()),
  });
}

export function buildLayerLookup(files: readonly FileNode[]): LayerLookup {
  const levelByPath: Record<string, number>   = {};
  const roleByPath:  Record<string, FileRole> = {};
  for (const f of files) {
    levelByPath[f.path] = f.layer;
    roleByPath[f.path]  = f.role;
  }
  return Object.freeze({
    levelByPath: Object.freeze(levelByPath),
    roleByPath:  Object.freeze(roleByPath),
  });
}

export function resolveFileLayer(
  path:        string,
  definitions: readonly LayerDefinition[],
  role:        FileRole,
): number {
  for (const def of definitions) {
    if ((def.roles as readonly string[]).includes(role)) return def.level;
  }
  return 0;
}

export function getAllowedTargetLevels(
  fromLevel:   number,
  definitions: readonly LayerDefinition[],
): readonly number[] {
  const def = definitions.find((d) => d.level === fromLevel);
  return def ? def.mayImport : Object.freeze([]);
}
