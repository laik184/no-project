/**
 * run-writer.ts — Delegates to runRepository (write methods).
 * Kept for backward-compat. Import runRepository directly for new code.
 */
import { runRepository } from '../../repositories/chat/run.repository.ts';

export const runWriter = {
  create:    runRepository.create.bind(runRepository),
  setStatus: runRepository.setStatus.bind(runRepository),
};
