/**
 * preview-repository.ts — IPreviewRepository interface.
 * Abstracts persistence for preview sessions and states.
 */

import type { PreviewSession } from "../entities/preview-session.ts";
import type { PreviewState }   from "../entities/preview-state.ts";

export interface IPreviewRepository {
  // ── Sessions ────────────────────────────────────────────────────────────────
  createSession(session: PreviewSession): Promise<void>;
  updateSession(session: PreviewSession): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  findSessionById(sessionId: string): Promise<PreviewSession | null>;
  findSessionsByProjectId(projectId: number): Promise<PreviewSession[]>;
  findAllSessions(): Promise<PreviewSession[]>;

  // ── State ───────────────────────────────────────────────────────────────────
  saveState(state: PreviewState): Promise<void>;
  findState(projectId: number): Promise<PreviewState | null>;
  findAllStates(): Promise<PreviewState[]>;
  deleteState(projectId: number): Promise<void>;
}
