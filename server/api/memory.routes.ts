/**
 * server/api/memory.routes.ts  (Phase 1 split — thin combiner ≤20 lines)
 *
 * Composes the MemorySystem router and MemoryPipeline router into one mount point.
 * Route logic lives in bounded-context files:
 *   memory-system.routes.ts   — claims / facts / promotion / context / events
 *   memory-pipeline.routes.ts — observe / retrieve / inject / classify / reconcile / archive
 */

import { Router } from "express";
import { createMemorySystemRouter }   from "./memory-system.routes.ts";
import { createMemoryPipelineRouter } from "./memory-pipeline.routes.ts";

export function createMemoryRouter(): Router {
  const r = Router();
  r.use(createMemorySystemRouter());
  r.use(createMemoryPipelineRouter());
  return r;
}
