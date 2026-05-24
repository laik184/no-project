/**
 * agent-promise-registry.ts
 *
 * Promise-based handshake registry for DAG agent nodes.
 *
 * When the DAG dispatcher launches an agent node, it registers a promise here.
 * The agent runner, on completion, calls resolve() or reject().
 * This converts the fire-and-forget bus dispatch into a proper async await.
 *
 * Single responsibility: promise lifecycle only. No execution logic.
 */

export interface AgentNodeHandle {
  resolve: (result: unknown) => void;
  reject:  (err: Error)     => void;
  promise: Promise<unknown>;
}

const DEFAULT_TIMEOUT_MS = 300_000;   // 5 min — long-running agents

class AgentPromiseRegistry {
  private handles = new Map<string, AgentNodeHandle>();

  /**
   * Register a promise for the given key (nodeId or runId:nodeId).
   * Returns the promise that will settle when the agent finishes.
   */
  register(key: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    // Clean up any stale entry first
    this.handles.delete(key);

    let resolve!: (v: unknown) => void;
    let reject!:  (e: Error)   => void;

    const promise = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject  = rej;
    });

    // Timeout guard: REJECT (fail-closed) — fake success would corrupt the DAG.
    // A timedOut node must be visible as a failure so rollback/retry can fire.
    const timer = setTimeout(() => {
      if (this.handles.has(key)) {
        console.error(
          `[agent-promise-registry] Timeout for key="${key}" after ${timeoutMs}ms — rejecting (fail-closed)`,
        );
        this.handles.delete(key);
        reject(new Error(`dag_agent_timeout:${key}:${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Wrap resolve/reject to clear the timer and remove the handle
    const wrappedResolve = (v: unknown) => {
      clearTimeout(timer);
      this.handles.delete(key);
      resolve(v);
    };
    const wrappedReject = (e: Error) => {
      clearTimeout(timer);
      this.handles.delete(key);
      reject(e);
    };

    this.handles.set(key, { resolve: wrappedResolve, reject: wrappedReject, promise });
    return promise;
  }

  /**
   * Resolve a registered promise with a result.
   * No-op if the key is not registered (e.g., already timed out).
   */
  resolve(key: string, result: unknown): boolean {
    const handle = this.handles.get(key);
    if (!handle) return false;
    handle.resolve(result);
    return true;
  }

  /**
   * Reject a registered promise with an error.
   */
  reject(key: string, err: Error): boolean {
    const handle = this.handles.get(key);
    if (!handle) return false;
    handle.reject(err);
    return true;
  }

  /** Check if a key is currently registered (agent running). */
  has(key: string): boolean {
    return this.handles.has(key);
  }

  /** Count of active handles. */
  size(): number {
    return this.handles.size;
  }

  /** Build the canonical key from runId + nodeId. */
  static key(runId: string, nodeId: string): string {
    return `${runId}:${nodeId}`;
  }
}

// Singleton
export const agentPromiseRegistry = new AgentPromiseRegistry();
