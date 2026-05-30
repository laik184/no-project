/**
 * server/memory/bootstrap.ts
 *
 * Purpose: One-time boot sequence for the memory platform.
 * Responsibility: Register all domain stores with the registry, then boot
 *   the manager. Call once at application startup.
 * Exports: bootstrapMemory()
 */

import { memoryRegistry }    from './core/memory-registry.ts';
import { memoryManager }     from './core/memory-manager.ts';

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

let booted = false;

export function bootstrapMemory(options: {
  evictionIntervalMs?: number;
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

  console.log(
    `[memory] Platform ready — ${memoryRegistry.size()} stores registered`,
  );
}
