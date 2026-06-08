/**
 * runtime-health-repository.ts — IRuntimeHealthRepository interface.
 * Abstracts persistence for runtime health snapshots.
 */

import type { RuntimeHealth } from "../entities/runtime-health.ts";

export interface IRuntimeHealthRepository {
  save(health: RuntimeHealth): Promise<void>;
  findByProjectId(projectId: number): Promise<RuntimeHealth | null>;
  findAll(): Promise<RuntimeHealth[]>;
  delete(projectId: number): Promise<void>;
}
