/**
 * server/api/memory.routes.ts
 *
 * HTTP API for the Memory Reliability subsystem.
 *
 * POST /api/memory/:namespace/claims
 *   Write an AgentClaim. Governance-checked before store.
 *   Body: { claim, sourceRunId, confidence, relatedEvidenceIds? }
 *
 * GET  /api/memory/:namespace/facts
 *   Retrieve verified facts for a namespace.
 *   Query: ?keys=a,b&limit=20
 *
 * GET  /api/memory/:namespace/claims
 *   Retrieve active claims. Query: ?status=unverified&limit=20
 *
 * POST /api/memory/:namespace/promote
 *   Promote a claim to a verified fact via external evidence.
 *   Body: { claimId, verifier, factKey, factValue, evidence[], factTtlMs? }
 *
 * GET  /api/memory/:namespace/context
 *   Build a deterministic context block set for LLM injection.
 *   Query: ?taskDescription=...&maxBlocks=20&includeUnverified=true
 *
 * GET  /api/memory/events
 *   Return recent memory events. Query: ?limit=50
 *
 * GET  /api/memory/:namespace/summary
 *   Namespace health summary (counts, violations, integrity).
 *
 * DELETE /api/memory/:namespace/expire
 *   Trigger an immediate expiration sweep.
 */

import { Router, type Request, type Response } from "express";
import { MemorySystem } from "../memory/index.ts";
import type { EvidenceInput, PromotionRequest } from "../memory/index.ts";
import {
  getProjectEntries,
  getAllEntries,
  getStoreStats,
  retrieve,
  observe,
  reconcile,
  archive,
}                            from "../memory/pipeline/memory-pipeline.ts";
import { injectMemoryContext } from "../memory/injection/memory-injector.ts";
import { classifyMemory }    from "../memory/classifier/memory-classifier.ts";

// One system per namespace (created lazily, not singletons).
const systems = new Map<string, MemorySystem>();

function getSystem(namespace: string): MemorySystem {
  if (!systems.has(namespace)) {
    const sys = new MemorySystem({ defaultClaimTtlMs: 5 * 60_000, defaultFactTtlMs: 30 * 60_000 });
    sys.startExpiration(60_000);
    systems.set(namespace, sys);
  }
  return systems.get(namespace)!;
}

export function createMemoryRouter(): Router {
  const r = Router();

  // ── Write a claim ─────────────────────────────────────────────────────────
  r.post("/:namespace/claims", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const { claim, sourceRunId, confidence, relatedEvidenceIds } = req.body;

    const sys    = getSystem(namespace);
    const id     = sys.generateId("claim");
    const valRes = sys.claimValidator.validateInput(claim, namespace, sourceRunId, confidence);
    if (!valRes.valid) { res.status(400).json({ ok: false, error: valRes.reason }); return; }

    const written  = sys.claims.write({ id, claim, namespace, sourceRunId, confidence, relatedEvidenceIds });
    const decision = sys.governance.checkClaimWrite(written);
    if (!decision.allowed) {
      sys.claims.markExpired(written.id, `governance blocked: ${decision.reason}`);
      res.status(422).json({ ok: false, blocked: true, reason: decision.reason });
      return;
    }

    res.status(201).json({ ok: true, claimId: written.id, warnings: decision.warnings });
  });

  // ── Retrieve facts ────────────────────────────────────────────────────────
  r.get("/:namespace/facts", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const keys  = req.query.keys ? String(req.query.keys).split(",") : undefined;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    const result = getSystem(namespace).retrieval.retrieve({ namespace, keys, limit });
    res.json({
      ok: true,
      facts:      result.facts.map((s) => ({ ...s.item, score: s.score })),
      totalFacts: result.totalFacts,
      retrievedAt: result.retrievedAt,
    });
  });

  // ── Retrieve claims ───────────────────────────────────────────────────────
  r.get("/:namespace/claims", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const status = (req.query.status as string) || "unverified";
    const limit  = Math.min(Number(req.query.limit ?? 50), 200);

    const sys    = getSystem(namespace);
    const claims = sys.claims.listByStatus(status as any, namespace).slice(0, limit);
    res.json({ ok: true, claims, total: claims.length });
  });

  // ── Promote claim to fact ─────────────────────────────────────────────────
  r.post("/:namespace/promote", async (req: Request, res: Response) => {
    const { namespace } = req.params;
    const { claimId, verifier, factKey, factValue, evidence = [], factTtlMs } = req.body;

    if (!claimId || !verifier || !factKey) {
      res.status(400).json({ ok: false, error: "claimId, verifier, and factKey required" });
      return;
    }

    const sys = getSystem(namespace);
    const collectedEvidence = sys.evidence.collectMany(
      (evidence as EvidenceInput[]).map((e) => ({ source: e.source, data: e.data, ttlMs: e.ttlMs }))
    );

    const request: PromotionRequest = {
      claimId, verifier,
      evidence: collectedEvidence,
      namespace,
      runId: req.body.runId ?? "api",
    };

    try {
      const result = await sys.promotion.promote(request, { factKey, factValue, factTtlMs });
      res.status(result.ok ? 200 : 422).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // ── Build context ─────────────────────────────────────────────────────────
  r.get("/:namespace/context", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const { taskDescription, maxBlocks, includeUnverified, runId } = req.query;

    const ctx = getSystem(namespace).context.build({
      namespace,
      runId:             String(runId ?? "api"),
      taskDescription:   taskDescription ? String(taskDescription) : undefined,
      maxBlocks:         maxBlocks ? Number(maxBlocks) : undefined,
      includeUnverified: includeUnverified !== "false",
    });

    res.json({ ok: true, ...ctx, blocks: ctx.blocks });
  });

  // ── Recent events ─────────────────────────────────────────────────────────
  r.get("/events", (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const ns    = req.query.namespace as string | undefined;
    const sys   = ns ? getSystem(ns) : getSystem("default");
    const events = sys.events.tail(limit);
    res.json({ ok: true, events, total: sys.events.length });
  });

  // ── Namespace summary ─────────────────────────────────────────────────────
  r.get("/:namespace/summary", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const sys = getSystem(namespace);
    const integrity = sys.verifyIntegrity();

    res.json({
      ok: true,
      namespace,
      ...sys.retrieval.namespaceSummary(namespace),
      quarantined:      sys.quarantineSize,
      violations:       sys.audit.violationCount(namespace),
      blockedWrites:    sys.audit.blockedCount(namespace),
      eventLogSize:     integrity.totalEvents,
      eventLogIntact:   integrity.valid,
    });
  });

  // ── Trigger expiration sweep ──────────────────────────────────────────────
  r.delete("/:namespace/expire", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const report = getSystem(namespace).expiration.sweep();
    res.json({ ok: true, report });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ── SEMANTIC MEMORY PIPELINE ENDPOINTS ────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/memory/pipeline/stats
  r.get("/pipeline/stats", (_req: Request, res: Response) => {
    res.json({ ok: true, ...getStoreStats() });
  });

  // GET /api/memory/pipeline/:projectId/entries
  r.get("/pipeline/:projectId/entries", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const entries = getProjectEntries(projectId);
    res.json({
      ok: true, projectId, count: entries.length,
      entries: entries.map(e => ({
        id: e.id, category: e.category, content: e.content.slice(0, 200),
        tags: e.tags, score: e.score, usedCount: e.usedCount,
        createdAt: e.createdAt, hasEmbedding: !!e.embedding,
      })),
    });
  });

  // GET /api/memory/pipeline/all
  r.get("/pipeline/all", (_req: Request, res: Response) => {
    const entries = getAllEntries();
    res.json({
      ok: true, count: entries.length,
      entries: entries.map(e => ({
        id: e.id, projectId: e.projectId, category: e.category,
        content: e.content.slice(0, 150), score: e.score,
        usedCount: e.usedCount, createdAt: e.createdAt,
      })),
    });
  });

  // POST /api/memory/pipeline/:projectId/retrieve
  r.post("/pipeline/:projectId/retrieve", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const { query, topK = 8, minScore = 0.25 } = req.body as { query?: string; topK?: number; minScore?: number };
    if (!query?.trim()) return res.status(400).json({ ok: false, error: "Required: query" });
    try {
      const ranked = await retrieve(query, projectId, undefined, { topK, minScore });
      res.json({
        ok: true, projectId, query, count: ranked.length,
        results: ranked.map(r => ({
          id: r.memory.id, category: r.memory.category,
          content: r.memory.content.slice(0, 300), tags: r.memory.tags,
          similarity: r.similarity, finalScore: r.finalScore, relevanceNote: r.relevanceNote,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // POST /api/memory/pipeline/:projectId/observe
  r.post("/pipeline/:projectId/observe", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const { content, runId, context, success, fromReflection } = req.body as {
      content?: string; runId?: string; context?: string; success?: boolean; fromReflection?: boolean;
    };
    if (!content?.trim()) return res.status(400).json({ ok: false, error: "Required: content" });
    try {
      const entry = await observe({ content, projectId, runId, context, hint: { success, fromReflection } });
      if (!entry) return res.json({ ok: true, stored: false, reason: "duplicate_or_empty" });
      res.json({ ok: true, stored: true, entryId: entry.id, category: entry.category });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // POST /api/memory/pipeline/:projectId/inject
  r.post("/pipeline/:projectId/inject", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const { query, runId = "api", phase = "api" } = req.body as { query?: string; runId?: string; phase?: string };
    if (!query?.trim()) return res.status(400).json({ ok: false, error: "Required: query" });
    try {
      const result = await injectMemoryContext({ query, projectId, runId, phase });
      res.json({ ok: true, projectId, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // POST /api/memory/pipeline/:projectId/classify
  r.post("/pipeline/:projectId/classify", (req: Request, res: Response) => {
    const { content, success, fromReflection, fromRuntime } = req.body as {
      content?: string; success?: boolean; fromReflection?: boolean; fromRuntime?: boolean;
    };
    if (!content?.trim()) return res.status(400).json({ ok: false, error: "Required: content" });
    res.json({ ok: true, ...classifyMemory(content, { success, fromReflection, fromRuntime }) });
  });

  // POST /api/memory/pipeline/:projectId/reconcile
  r.post("/pipeline/:projectId/reconcile", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const before = getProjectEntries(projectId).length;
    reconcile(projectId);
    const after  = getProjectEntries(projectId).length;
    res.json({ ok: true, projectId, before, after, removed: before - after });
  });

  // POST /api/memory/pipeline/:projectId/archive
  r.post("/pipeline/:projectId/archive", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const before = getProjectEntries(projectId).length;
    archive(projectId);
    const after  = getProjectEntries(projectId).length;
    res.json({ ok: true, projectId, before, after, archived: before - after });
  });

  return r;
}
