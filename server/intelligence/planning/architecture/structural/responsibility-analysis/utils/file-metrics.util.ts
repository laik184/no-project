import type { FileDescriptor, FileRole } from "../types.js";
import { LINE_COUNT_THRESHOLD } from "../types.js";

export interface FileMetrics {
  readonly path:           string;
  readonly lineCount:      number;
  readonly isOversized:    boolean;
  readonly exportCount:    number;
  readonly role:           FileRole;
  readonly complexityHint: "LOW" | "MEDIUM" | "HIGH";
}

function deriveComplexity(
  lineCount:   number,
  exportCount: number,
): "LOW" | "MEDIUM" | "HIGH" {
  if (lineCount > LINE_COUNT_THRESHOLD || exportCount > 10) return "HIGH";
  if (lineCount > 150               || exportCount > 5)   return "MEDIUM";
  return "LOW";
}

export function computeFileMetrics(file: Readonly<FileDescriptor>): FileMetrics {
  const exportCount = file.exports.length;
  return Object.freeze({
    path:           file.path,
    lineCount:      file.lineCount,
    isOversized:    file.lineCount > LINE_COUNT_THRESHOLD,
    exportCount,
    role:           file.role,
    complexityHint: deriveComplexity(file.lineCount, exportCount),
  });
}

export function computeAllMetrics(
  files: readonly FileDescriptor[],
): readonly FileMetrics[] {
  return Object.freeze(files.map(computeFileMetrics));
}

export function oversizedFiles(
  metrics: readonly FileMetrics[],
): readonly FileMetrics[] {
  return Object.freeze(metrics.filter((m) => m.isOversized));
}

export function highComplexityFiles(
  metrics: readonly FileMetrics[],
): readonly FileMetrics[] {
  return Object.freeze(metrics.filter((m) => m.complexityHint === "HIGH"));
}

export function averageLineCount(metrics: readonly FileMetrics[]): number {
  if (metrics.length === 0) return 0;
  const total = metrics.reduce((s, m) => s + m.lineCount, 0);
  return Math.round(total / metrics.length);
}

export function exportDensity(metrics: readonly FileMetrics[]): number {
  if (metrics.length === 0) return 0;
  const total = metrics.reduce((s, m) => s + m.exportCount, 0);
  return Math.round((total / metrics.length) * 10) / 10;
}
