/**
 * Responsibility: Lease lifecycle management — creates, renews, and expires leases
 *                 on behalf of distributed lock holders.
 * Dependencies: lock-registry
 * Failure: non-renewable leases cannot be extended; expire naturally via registry eviction.
 * Telemetry: emits lock.acquired / lock.released events (via distributed-trace callers).
 */

import { lockRegistry, LockEntry } from "./lock-registry.ts";
import { randomUUID }              from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_LEASE_MS  = 30_000;   // 30 seconds
const MAX_LEASE_MS      = 300_000;  // 5 minutes hard cap
const RENEWAL_WINDOW_MS = 5_000;    // renew when < 5s left

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeaseAcquireOptions {
  leaseMs?:    number;
  renewable?:  boolean;
  ownerId:     string;
}

export interface Lease {
  key:       string;
  token:     string;
  expiresAt: number;
  renewable: boolean;
}

// ── Manager ───────────────────────────────────────────────────────────────────

class LeaseManager {
  /** Try to acquire a lease for a resource key. Returns null if already locked. */
  acquire(key: string, opts: LeaseAcquireOptions): Lease | null {
    const leaseMs = Math.min(opts.leaseMs ?? DEFAULT_LEASE_MS, MAX_LEASE_MS);
    const token   = randomUUID();
    const now     = Date.now();

    const entry: LockEntry = {
      key,
      ownerId:    opts.ownerId,
      token,
      acquiredAt: now,
      expiresAt:  now + leaseMs,
      renewable:  opts.renewable ?? true,
    };

    const ok = lockRegistry.tryAcquire(entry);
    if (!ok) return null;

    return { key, token, expiresAt: entry.expiresAt, renewable: entry.renewable };
  }

  /** Release a lease using the token. Returns false if token mismatch or not held. */
  release(key: string, token: string): boolean {
    return lockRegistry.release(key, token);
  }

  /** Renew a lease if within the renewal window and it's renewable. */
  renew(lease: Lease, extendMs?: number): boolean {
    const entry = lockRegistry.getHolder(lease.key);
    if (!entry || !entry.renewable) return false;

    const remaining = lease.expiresAt - Date.now();
    if (remaining > RENEWAL_WINDOW_MS) return true; // not yet time to renew

    const ext = Math.min(extendMs ?? DEFAULT_LEASE_MS, MAX_LEASE_MS);
    return lockRegistry.renew(lease.key, lease.token, ext);
  }

  /** Returns true if the key is currently held by someone. */
  isHeld(key: string): boolean {
    return lockRegistry.isLocked(key);
  }

  /** Wait until a key is released (polling) or timeout. */
  async waitForRelease(key: string, maxWaitMs = 10_000, pollMs = 100): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      if (!lockRegistry.isLocked(key)) return true;
      await new Promise<void>(r => setTimeout(r, pollMs));
    }
    return false;
  }
}

export const leaseManager = new LeaseManager();
