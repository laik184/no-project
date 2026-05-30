/**
 * server/memory/learning-memory/capability-tracker.ts
 *
 * Purpose: Tracks capability growth over time based on learning entries.
 * Responsibility: Aggregate learning entries into domain-level capability scores.
 *   Read-only view over the learning store.
 * Exports: CapabilityTracker, capabilityTracker (singleton)
 */

import { learningStore } from './learning-store.ts';

export interface CapabilitySnapshot {
  domain:         string;
  lessonCount:    number;
  validatedCount: number;
  avgScore:       number;
  growth:         number;   // validated / total, 0.0–1.0
  lastUpdated:    number;
}

export class CapabilityTracker {

  /** Compute capability snapshot for a specific domain. */
  async domainSnapshot(domain: string): Promise<CapabilitySnapshot> {
    const entries  = await learningStore.byDomain(domain);
    const total    = entries.length;
    const validated = entries.filter(e => e.validated).length;
    const avgScore = total > 0
      ? entries.reduce((s, e) => s + e.score, 0) / total
      : 0;
    const lastUpdated = entries.reduce(
      (max, e) => Math.max(max, e.updatedAt), 0,
    );
    return {
      domain,
      lessonCount:    total,
      validatedCount: validated,
      avgScore,
      growth:         total > 0 ? validated / total : 0,
      lastUpdated,
    };
  }

  /** Snapshot for all domains that have at least one learning entry. */
  async allSnapshots(): Promise<CapabilitySnapshot[]> {
    const all     = await learningStore.list();
    const domains = new Set(all.map(e => e.domain));
    return Promise.all([...domains].map(d => this.domainSnapshot(d)));
  }

  /** Return top N domains by growth score. */
  async topDomains(limit = 5): Promise<CapabilitySnapshot[]> {
    const all = await this.allSnapshots();
    return all.sort((a, b) => b.growth - a.growth).slice(0, limit);
  }
}

export const capabilityTracker = new CapabilityTracker();
