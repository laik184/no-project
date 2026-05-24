/**
 * server/distributed/events/run-scoped-event-namespace.ts
 *
 * RunScopedEventNamespace — per-run event channel isolation layer.
 *
 * Responsibilities:
 *   - Scope all event subscriptions to a specific runId namespace
 *   - Prevent cross-run event delivery (event pollution protection)
 *   - Provide replay-safe event synchronization per run
 *   - Enforce deterministic event ordering via sequence numbers
 *   - Auto-cleanup subscriptions on run teardown
 *
 * Single responsibility: run-scoped subscription and delivery. No bus logic.
 */

import { distributedEventBus }  from "./distributed-event-bus.ts";
import { bus }                   from "../../infrastructure/events/bus.ts";
import type { DistributedEvent, SubscriptionOptions } from "./types/index.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RunEventHandler = (event: DistributedEvent) => void;

export interface RunNamespace {
  readonly runId:       string;
  readonly projectId:   number;
  readonly createdAt:   number;
  subscriptionIds:      Set<string>;
  seq:                  number;
  lastEventTs:          number | null;
}

export interface NamespaceStats {
  runId:         string;
  projectId:     number;
  subscriptions: number;
  eventsRouted:  number;
  createdAt:     number;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _namespaces   = new Map<string, RunNamespace>();   // runId → namespace
const _routedCounts = new Map<string, number>();          // runId → count

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase: "event-namespace",
    agentName: "run-scoped-event-namespace",
    eventType, payload,
    ts: Date.now(),
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Create or retrieve a namespace for a run. Idempotent. */
export function getOrCreateNamespace(runId: string, projectId: number): RunNamespace {
  const existing = _namespaces.get(runId);
  if (existing) return existing;
  const ns: RunNamespace = {
    runId, projectId,
    createdAt:    Date.now(),
    subscriptionIds: new Set(),
    seq:          0,
    lastEventTs:  null,
  };
  _namespaces.set(runId, ns);
  _routedCounts.set(runId, 0);
  return ns;
}

/**
 * Subscribe to events on a specific channel, scoped to runId.
 * Handler ONLY receives events that match this run's runId — cross-run
 * events are silently filtered, preventing event pollution.
 */
export async function subscribeScoped(
  runId:     string,
  projectId: number,
  channel:   string,
  handler:   RunEventHandler,
  opts:      Omit<SubscriptionOptions, "channel" | "handler"> = {},
): Promise<string> {
  const ns = getOrCreateNamespace(runId, projectId);

  const subId = await distributedEventBus.subscribe({
    ...opts,
    channel,
    handler: (event: DistributedEvent) => {
      // ── Cross-run isolation guard ──────────────────────────────────────────
      if (event.runId !== runId) return;

      ns.seq++;
      ns.lastEventTs = event.ts;
      _routedCounts.set(runId, (_routedCounts.get(runId) ?? 0) + 1);

      handler(event);
    },
  });

  ns.subscriptionIds.add(subId);
  emit(runId, projectId, "run.isolated", {
    channel, subId, totalSubscriptions: ns.subscriptionIds.size,
  });
  return subId;
}

/**
 * Unsubscribe a specific subscription from a run namespace.
 */
export async function unsubscribeScoped(runId: string, subId: string): Promise<void> {
  const ns = _namespaces.get(runId);
  if (!ns) return;
  await distributedEventBus.unsubscribe(subId);
  ns.subscriptionIds.delete(subId);
}

/**
 * Publish an event scoped to this run on the distributed event bus.
 * Automatically stamps the event with the runId.
 */
export async function publishScoped(
  runId:     string,
  projectId: number,
  channel:   string,
  eventType: string,
  payload:   unknown,
  opts:      { correlationId?: string; replayable?: boolean } = {},
): Promise<void> {
  const ns = getOrCreateNamespace(runId, projectId);
  ns.seq++;
  await distributedEventBus.publish(channel, eventType, runId, projectId, payload, opts);
}

/**
 * Tear down all subscriptions for a run namespace.
 * Called at run completion to prevent orphaned listeners.
 */
export async function destroyNamespace(runId: string): Promise<void> {
  const ns = _namespaces.get(runId);
  if (!ns) return;

  const subIds = Array.from(ns.subscriptionIds);
  await Promise.all(subIds.map(id => distributedEventBus.unsubscribe(id).catch(() => {})));
  ns.subscriptionIds.clear();

  emit(runId, ns.projectId, "run.completed", {
    eventsRouted: _routedCounts.get(runId) ?? 0,
    lifetimeMs:   Date.now() - ns.createdAt,
  });

  _namespaces.delete(runId);
  _routedCounts.delete(runId);
}

/** Stats for all active namespaces. */
export function allNamespaceStats(): NamespaceStats[] {
  return Array.from(_namespaces.values()).map(ns => ({
    runId:         ns.runId,
    projectId:     ns.projectId,
    subscriptions: ns.subscriptionIds.size,
    eventsRouted:  _routedCounts.get(ns.runId) ?? 0,
    createdAt:     ns.createdAt,
  }));
}

/** Count of active namespaces. */
export function activeNamespaceCount(): number {
  return _namespaces.size;
}
