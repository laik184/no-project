/**
 * memory-pipeline.routes.ts
 *
 * HTTP routes for the semantic Memory Pipeline (observe / retrieve / inject / classify / reconcile / archive).
 * Extracted from memory.routes.ts (Phase 1 split — ≤250 lines).
 *
 * Bounded context: memory-pipeline lifecycle only.
 */

import { Router, type Request, type Response } from "express";
import {
  getProjectEntries,
  getAllEntries,
  getStoreStats,
  retrieve,
  observe,
}                            from "../memory/pipeline/memory-pipeline.ts";
import { injectMemoryContext } from "../memory/injection/memory-injector.ts";
import { classifyMemory }    from "../memory/classifier/memory-classifier.ts";
import { reconcile, archive } from "../memory/pipeline/memory-store-internal.ts";

// ── Router factory ─────────────────────────────────────────────────────────────

export function createMemoryPipelineRouter(): Router {
  const r = Router();

  // GET /pipeline/stats
  r.get("/pipeline/stats", (_req: Request, res: Response) => {
    res.json({ ok: true, ...getStoreStats() });
  });

  // GET /pipeline/all
  r.get("/pipeline/all", (_req: Request, res: Response) => {
    const entries = getAllEntries();
    res.json({
      ok: true, count: entries.length,
      entries: entries.map((e) => ({
        id: e.id, projectId: e.projectId, category: e.category,
        content: e.content.slice(0, 150), score: e.score,
        usedCount: e.usedCount, createdAt: e.createdAt,
      })),
    });
  });

  // GET /pipeline/:projectId/entries
  r.get("/pipeline/:projectId/entries", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) { res.status(400).json({ ok: false, error: "Invalid projectId" }); return; }
    const entries = getProjectEntries(projectId);
    res.json({
      ok: true, projectId, count: entries.length,
      entries: entries.map((e) => ({
        id: e.id, category: e.category, content: e.content.slice(0, 200),
        tags: e.tags, score: e.score, usedCount: e.usedCount,
        createdAt: e.createdAt, hasEmbedding: !!e.embedding,
      })),
    });
  });

  // POST /pipeline/:projectId/retrieve
  r.post("/pipeline/:projectId/retrieve", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const { query, topK = 8, minScore = 0.25 } = req.body as {
      query?: string; topK?: number; minScore?: number;
    };
    if (!query?.trim()) { res.status(400).json({ ok: false, error: "Required: query" }); return; }
    try {
      const ranked = await retrieve(query, projectId, undefined, { topK, minScore });
      res.json({
        ok: true, projectId, query, count: ranked.length,
        results: ranked.map((r) => ({
          id:            r.memory.id,
          category:      r.memory.category,
          content:       r.memory.content.slice(0, 300),
          tags:          r.memory.tags,
          similarity:    r.similarity,
          finalScore:    r.finalScore,
          relevanceNote: r.relevanceNote,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // POST /pipeline/:projectId/observe
  r.post("/pipeline/:projectId/observe", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const { content, runId, context, success, fromReflection } = req.body as {
      content?: string; runId?: string; context?: string;
      success?: boolean; fromReflection?: boolean;
    };
    if (!content?.trim()) { res.status(400).json({ ok: false, error: "Required: content" }); return; }
    try {
      const entry = await observe({ content, projectId, runId, context, hint: { success, fromReflection } });
      if (!entry) { res.json({ ok: true, stored: false, reason: "duplicate_or_empty" }); return; }
      res.json({ ok: true, stored: true, entryId: entry.id, category: entry.category });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // POST /pipeline/:projectId/inject
  r.post("/pipeline/:projectId/inject", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const { query, runId = "api", phase = "api" } = req.body as {
      query?: string; runId?: string; phase?: string;
    };
    if (!query?.trim()) { res.status(400).json({ ok: false, error: "Required: query" }); return; }
    try {
      const result = await injectMemoryContext({ query, projectId, runId, phase });
      res.json({ ok: true, projectId, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // POST /pipeline/:projectId/classify
  r.post("/pipeline/:projectId/classify", (req: Request, res: Response) => {
    const { content, success, fromReflection, fromRuntime } = req.body as {
      content?: string; success?: boolean; fromReflection?: boolean; fromRuntime?: boolean;
    };
    if (!content?.trim()) { res.status(400).json({ ok: false, error: "Required: content" }); return; }
    res.json({ ok: true, ...classifyMemory(content, { success, fromReflection, fromRuntime }) });
  });

  // POST /pipeline/:projectId/reconcile
  r.post("/pipeline/:projectId/reconcile", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const before = getProjectEntries(projectId).length;
    reconcile(projectId);
    const after = getProjectEntries(projectId).length;
    res.json({ ok: true, projectId, before, after, removed: before - after });
  });

  // POST /pipeline/:projectId/archive
  r.post("/pipeline/:projectId/archive", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const before = getProjectEntries(projectId).length;
    archive(projectId);
    const after = getProjectEntries(projectId).length;
    res.json({ ok: true, projectId, before, after, archived: before - after });
  });

  return r;
}
