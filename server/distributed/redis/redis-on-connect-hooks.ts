/**
 * Responsibility: Registry of callbacks that fire once when Redis transitions
 *                 from unavailable → available for the first time after startup.
 *                 Enables lazy re-initialization of Redis-dependent subsystems.
 * Dependencies: none
 * Failure: hook errors are caught + logged; remaining hooks still execute.
 * Telemetry: logs each hook invocation; never throws.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnectHook = () => void | Promise<void>;

interface HookEntry {
  name: string;
  fn:   ConnectHook;
}

// ── Registry ─────────────────────────────────────────────────────────────────

class RedisOnConnectHooks {
  private readonly hooks: HookEntry[] = [];
  private fired = false;

  /**
   * Register a callback to run when Redis first becomes available.
   * If Redis is already available, the callback is invoked immediately.
   */
  register(name: string, fn: ConnectHook): void {
    if (this.fired) {
      // Redis already up — run immediately so late registrants still init.
      Promise.resolve(fn()).catch(err =>
        console.error(`[redis-on-connect-hooks] Late hook "${name}" failed:`, (err as Error).message),
      );
      return;
    }
    this.hooks.push({ name, fn });
  }

  /**
   * Fire all registered hooks. Called once by redis-client on the `ready` event.
   * Idempotent: subsequent calls are no-ops until reset() is called.
   */
  async fire(): Promise<void> {
    if (this.fired) return;
    this.fired = true;

    if (this.hooks.length === 0) return;

    console.log(`[redis-on-connect-hooks] Redis ready — firing ${this.hooks.length} on-connect hook(s)...`);

    for (const { name, fn } of this.hooks) {
      try {
        await Promise.resolve(fn());
        console.log(`[redis-on-connect-hooks] ✓ ${name}`);
      } catch (err) {
        console.error(`[redis-on-connect-hooks] ✗ ${name}:`, (err as Error).message);
      }
    }
  }

  /**
   * Reset — allows hooks to fire again after reconnection.
   * Call this from the redis-client `close` or `end` handler so that
   * subsystems can re-initialize if Redis drops and reconnects.
   */
  reset(): void {
    this.fired = false;
  }

  get registered(): number { return this.hooks.length; }
  get hasFired():   boolean { return this.fired; }
}

export const redisOnConnectHooks = new RedisOnConnectHooks();
