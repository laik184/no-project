/**
 * memory-system.routes.ts
 *
 * HTTP routes for the MemorySystem (claims / facts / promotion / context / events).
 * Extracted from memory.routes.ts (Phase 1 split — ≤250 lines).
 *
 * Bounded context: MemorySystem reliability subsystem only.
 */

import { Router, type Request, type Response } from "express";
import { MemorySystem } from "../memory/index.ts";
import type { EvidenceInput, PromotionRequest } from "../memory/index.ts";

// ── Namespace registry ─────────────────────────────────────────────────────────

const systems = new Map<string, MemorySystem>();

export function getSystem(namespace: string): MemorySystem {
  if (!systems.has(namespace)) {
    const sys = new MemorySystem({
      defaultClaimTtlMs: 5 * 60_000,
      defaultFactTtlMs:  30 * 60_000,
    });
    sys.startExpiration(60_000);
    systems.set(namespace, sys);
  }
  return systems.get(namespace)!;
}

// ── Router factory ─────────────────────────────────────────────────────────────

export function createMemorySystemRouter(): Router {
  const r = Router();

  // POST /:namespace/claims — write an AgentClaim
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

  // GET /:namespace/facts
  r.get("/:namespace/facts", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const keys  = req.query.keys ? String(req.query.keys).split(",") : undefined;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    const result = getSystem(namespace).retrieval.retrieve({ namespace, keys, limit });
    res.json({
      ok:          true,
      facts:       result.facts.map((s) => ({ ...s.item, score: s.score })),
      totalFacts:  result.totalFacts,
      retrievedAt: result.retrievedAt,
    });
  });

  // GET /:namespace/claims
  r.get("/:namespace/claims", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const status = (req.query.status as string) || "unverified";
    const limit  = Math.min(Number(req.query.limit ?? 50), 200);
    const claims = getSystem(namespace).claims.listByStatus(status as any, namespace).slice(0, limit);
    res.json({ ok: true, claims, total: claims.length });
  });

  // POST /:namespace/promote — promote claim to verified fact
  r.post("/:namespace/promote", async (req: Request, res: Response) => {
    const { namespace } = req.params;
    const { claimId, verifier, factKey, factValue, evidence = [], factTtlMs } = req.body;

    if (!claimId || !verifier || !factKey) {
      res.status(400).json({ ok: false, error: "claimId, verifier, and factKey required" });
      return;
    }

    const sys = getSystem(namespace);
    const collectedEvidence = sys.evidence.collectMany(
      (evidence as EvidenceInput[]).map((e) => ({ source: e.source, data: e.data, ttlMs: e.ttlMs })),
    );

    const request: PromotionRequest = {
      claimId, verifier,
      evidence:  collectedEvidence,
      namespace,
      runId:     req.body.runId ?? "api",
    };

    try {
      const result = await sys.promotion.promote(request, { factKey, factValue, factTtlMs });
      res.status(result.ok ? 200 : 422).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // GET /:namespace/context
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

  // GET /events
  r.get("/events", (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const ns    = req.query.namespace as string | undefined;
    const sys   = ns ? getSystem(ns) : getSystem("default");
    res.json({ ok: true, events: sys.events.tail(limit), total: sys.events.length });
  });

  // GET /:namespace/summary
  r.get("/:namespace/summary", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const sys       = getSystem(namespace);
    const integrity = sys.verifyIntegrity();
    res.json({
      ok: true, namespace,
      ...sys.retrieval.namespaceSummary(namespace),
      quarantined:    sys.quarantineSize,
      violations:     sys.audit.violationCount(namespace),
      blockedWrites:  sys.audit.blockedCount(namespace),
      eventLogSize:   integrity.totalEvents,
      eventLogIntact: integrity.valid,
    });
  });

  // DELETE /:namespace/expire
  r.delete("/:namespace/expire", (req: Request, res: Response) => {
    const { namespace } = req.params;
    const report = getSystem(namespace).expiration.sweep();
    res.json({ ok: true, report });
  });

  return r;
}
