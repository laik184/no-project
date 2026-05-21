/**
 * server/verification/typescript/audit-logger.ts
 *
 * VerificationAuditLogger — structured, typed, append-only event log.
 * Writes to stderr as newline-delimited JSON. No file I/O dependency.
 * Replayable. Deterministic ordering within a session.
 */

import { randomUUID } from "crypto";
import type { AuditLogEntry, AuditEventKind } from "./types.ts";

const PREFIX = "[ts-verify]";

export class VerificationAuditLogger {
  private readonly _sessionId: string;
  private _entries: AuditLogEntry[] = [];

  constructor(sessionId: string) {
    this._sessionId = sessionId;
  }

  get entries(): ReadonlyArray<AuditLogEntry> {
    return this._entries;
  }

  log(kind: AuditEventKind, data: Record<string, unknown> = {}): void {
    const entry: AuditLogEntry = Object.freeze({
      id: randomUUID(),
      sessionId: this._sessionId,
      kind,
      timestamp: Date.now(),
      data: Object.freeze({ ...data }),
    });
    this._entries.push(entry);
    this._emit(entry);
  }

  private _emit(entry: AuditLogEntry): void {
    try {
      process.stderr.write(
        `${PREFIX} ${JSON.stringify({
          id: entry.id,
          session: entry.sessionId,
          kind: entry.kind,
          ts: entry.timestamp,
          ...entry.data,
        })}\n`
      );
    } catch {
      // stdout/stderr write failure must never crash verification
    }
  }

  summarise(): string {
    return this._entries
      .map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.kind}`)
      .join("\n");
  }
}
