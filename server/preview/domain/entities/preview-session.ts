/**
 * preview-session.ts — PreviewSession domain entity.
 * Immutable value object. No methods, no mutation.
 */

export type PreviewSessionStatus = "active" | "idle" | "closed";

export interface PreviewSession {
  readonly id:         string;
  readonly projectId:  number;
  readonly status:     PreviewSessionStatus;
  readonly port:       number | null;
  readonly url:        string | null;
  readonly createdAt:  number;
  readonly updatedAt:  number;
}

export function createPreviewSession(
  id:        string,
  projectId: number,
  port:      number | null = null,
): PreviewSession {
  const now = Date.now();
  return Object.freeze({
    id,
    projectId,
    status:    "idle",
    port,
    url:       port ? `http://localhost:${port}` : null,
    createdAt: now,
    updatedAt: now,
  });
}

export function updatePreviewSession(
  session: PreviewSession,
  patch:   Partial<Pick<PreviewSession, "status" | "port" | "url">>,
): PreviewSession {
  return Object.freeze({
    ...session,
    ...patch,
    updatedAt: Date.now(),
  });
}
