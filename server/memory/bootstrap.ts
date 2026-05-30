/**
 * server/memory/bootstrap.ts
 *
 * Purpose: One-time boot sequence for the memory platform.
 * Responsibility: Register all domain stores with the registry, boot
 *   the manager, run startup hydration for in-process executor stores,
 *   and schedule the periodic reflection loop.
 * Call once at application startup.
 * Exports: bootstrapMemory()
 */

import { memoryRegistry }    from './core/memory-registry.ts';
import { memoryManager }     from './core/memory-manager.ts';
import { reflectionEngine }  from './reflection/reflection-engine.ts';
import { runStartupHydration } from './bootstrap/hydration-manager.ts';

// Domain stores
import { decisionStore }     from './decision-memory/decision-store.ts';
import { architectureStore } from './architecture-memory/architecture-store.ts';
import { bugStore }          from './bug-memory/bug-store.ts';
import { businessStore }     from './business-memory/business-store.ts';
import { feedbackStore }     from './user-feedback-memory/feedback-store.ts';
import { revenueStore }      from './revenue-memory/revenue-store.ts';
import { learningStore }     from './learning-memory/learning-store.ts';
import { predictionStore }   from './prediction-memory/prediction-store.ts';
import { executionStore }    from './execution-memory/execution-store.ts';
import { conversationStore } from './conversation-memory/conversation-store.ts';
import { reflectionStore }   from './reflection/reflection-store.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

const REFLECTION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let booted = false;

export function bootstrapMemory(options: {
  evictionIntervalMs?:   number;
  reflectionIntervalMs?: number;
} = {}): void {
  if (booted) return;
  booted = true;

  // Register all domain stores in category order
  memoryRegistry.register(decisionStore);
  memoryRegistry.register(architectureStore);
  memoryRegistry.register(bugStore);
  memoryRegistry.register(businessStore);
  memoryRegistry.register(feedbackStore);
  memoryRegistry.register(revenueStore);
  memoryRegistry.register(learningStore);
  memoryRegistry.register(predictionStore);
  memoryRegistry.register(executionStore);
  memoryRegistry.register(conversationStore);
  memoryRegistry.register(reflectionStore);

  // Boot lifecycle manager (TTL eviction, etc.)
  memoryManager.boot(options.evictionIntervalMs ?? 60_000);

  // ── Phase 1: Startup Hydration ─────────────────────────────────────────────
  // Restore in-process executor stores from the persisted memory platform.
  // Fire-and-forget: hydration failure must never prevent server startup.
  runStartupHydration({ idempotent: true, maxPerStore: 200 }).catch((err) => {
    console.error('[memory] Startup hydration error (non-fatal):', err instanceof Error ? err.message : err);
  });

  // Schedule periodic reflection loop (unref'd — won't keep process alive)
  const reflectionMs = options.reflectionIntervalMs ?? REFLECTION_INTERVAL_MS;
  const reflectionTimer = setInterval(async () => {
    try {
      const result = await reflectionEngine.reflect({ maxBugs: 10, maxExecutions: 10 });
      if (result.created > 0) {
        console.log(
          `[memory] Reflection pass: processed=${result.processed} created=${result.created} skipped=${result.skipped} (${result.durationMs}ms)`,
        );
      }
    } catch (err) {
      console.error('[memory] Reflection pass failed:', err instanceof Error ? err.message : err);
    }
  }, reflectionMs);
  reflectionTimer.unref();

  console.log(
    `[memory] Platform ready — ${memoryRegistry.size()} stores registered, reflection every ${reflectionMs / 1000}s`,
  );
}
