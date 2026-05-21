/**
 * server/execution-graph/graph-store.ts
 * In-memory store for execution graphs, with filesystem backup.
 * Single responsibility: read/write graphs. No business logic.
 */

import fs   from "fs/promises";
import path from "path";
import { getProjectDir } from "../infrastructure/sandbox/sandbox.util.ts";
import type { ExecutionGraph } from "./types.ts";

// ── In-memory cache ───────────────────────────────────────────────────────────

const _graphs = new Map<string, ExecutionGraph>(); // runId → graph

// ── Persistence path ──────────────────────────────────────────────────────────

function graphPath(projectId: number, runId: string): string {
  return path.join(getProjectDir(projectId), ".nura", "graphs", `${runId}.json`);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function storeGraph(graph: ExecutionGraph): void {
  _graphs.set(graph.runId, graph);
}

export function getGraph(runId: string): ExecutionGraph | undefined {
  return _graphs.get(runId);
}

export async function persistGraph(graph: ExecutionGraph): Promise<void> {
  const filePath = graphPath(graph.projectId, graph.runId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(graph, null, 2), "utf8");
}

export async function loadGraph(
  projectId: number,
  runId:     string,
): Promise<ExecutionGraph | undefined> {
  const cached = _graphs.get(runId);
  if (cached) return cached;

  try {
    const raw = await fs.readFile(graphPath(projectId, runId), "utf8");
    const graph = JSON.parse(raw) as ExecutionGraph;
    _graphs.set(runId, graph);
    return graph;
  } catch {
    return undefined;
  }
}

export function clearGraph(runId: string): void {
  _graphs.delete(runId);
}
