/**
 * reload-service.ts — Manages reload requests with debounce.
 * Imports ONLY from repositories/preview/index.ts.
 */

import { previewRepository } from "../../repositories/preview/index.ts";
import type { ReloadType }   from "../../preview/events/reload-events.ts";

interface PendingReload {
  projectId:  number;
  reloadType: ReloadType;
  timer:      ReturnType<typeof setTimeout>;
  reason:     string;
}

const DEBOUNCE_MS: Record<ReloadType, number> = {
  soft:             200,
  hard:             500,
  hot:              100,
  "server-restart": 1000,
};

export class ReloadService {
  private readonly pending = new Map<number, PendingReload>();
  private readonly callbacks = new Map<number, (type: ReloadType, reason: string) => void>();

  onReload(projectId: number, cb: (type: ReloadType, reason: string) => void): () => void {
    this.callbacks.set(projectId, cb);
    return () => this.callbacks.delete(projectId);
  }

  request(
    projectId:  number,
    reloadType: ReloadType,
    reason:     string,
  ): void {
    // Cancel any pending lower-priority reload
    const existing = this.pending.get(projectId);
    if (existing) {
      const priority: ReloadType[] = ["hot", "soft", "hard", "server-restart"];
      const existingP = priority.indexOf(existing.reloadType);
      const newP      = priority.indexOf(reloadType);
      // If new request is higher priority (further right), replace
      if (newP > existingP) {
        clearTimeout(existing.timer);
        this.pending.delete(projectId);
      } else {
        return; // existing request is already higher or equal priority
      }
    }

    const debounce = DEBOUNCE_MS[reloadType];
    const timer = setTimeout(() => {
      this.pending.delete(projectId);
      const cb = this.callbacks.get(projectId);
      if (cb) cb(reloadType, reason);
    }, debounce);

    this.pending.set(projectId, { projectId, reloadType, timer, reason });
  }

  cancel(projectId: number): void {
    const p = this.pending.get(projectId);
    if (p) {
      clearTimeout(p.timer);
      this.pending.delete(projectId);
    }
  }

  hasPending(projectId: number): boolean {
    return this.pending.has(projectId);
  }
}

export const reloadService = new ReloadService();
