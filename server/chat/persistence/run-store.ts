/**
 * run-store.ts — Delegates to runRepository (read methods).
 * Kept for backward-compat. Import runRepository directly for new code.
 */
import { runRepository } from '../../repositories/chat/run.repository.ts';

export type { ChatRun, RunStatus } from '../types/run.types.ts';

export const runStore = {
  findById:           runRepository.findById.bind(runRepository),
  findActiveByProject: runRepository.findActiveByProject.bind(runRepository),
  listByProject:      runRepository.listByProject.bind(runRepository),
  isActive:           runRepository.isActive.bind(runRepository),
};
