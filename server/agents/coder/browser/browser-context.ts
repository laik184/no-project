/**
 * browser-context.ts
 * Manages browser state observations for executor feedback loops.
 * The actual browser automation is handled by the Browser Agent —
 * this module stores and exposes its outputs to the executor.
 */

export interface BrowserSnapshot {
  runId:         string;
  projectId:     string;
  url:           string;
  screenshotPath?: string;
  consoleErrors: string[];
  networkErrors: string[];
  pageTitle:     string;
  capturedAt:    Date;
}

class BrowserContextStore {
  private snapshots = new Map<string, BrowserSnapshot>();

  store(runId: string, snapshot: BrowserSnapshot): void {
    this.snapshots.set(runId, snapshot);
  }

  get(runId: string): BrowserSnapshot | undefined {
    return this.snapshots.get(runId);
  }

  hasErrors(runId: string): boolean {
    const snap = this.snapshots.get(runId);
    if (!snap) return false;
    return snap.consoleErrors.length > 0 || snap.networkErrors.length > 0;
  }

  getErrors(runId: string): string[] {
    const snap = this.snapshots.get(runId);
    if (!snap) return [];
    return [...snap.consoleErrors, ...snap.networkErrors];
  }

  clear(runId: string): void {
    this.snapshots.delete(runId);
  }
}

export const browserContext = new BrowserContextStore();

/** Build an empty browser snapshot (placeholder when no browser run yet). */
export function emptySnapshot(runId: string, projectId: string): BrowserSnapshot {
  return {
    runId,
    projectId,
    url:           '',
    consoleErrors: [],
    networkErrors: [],
    pageTitle:     '',
    capturedAt:    new Date(),
  };
}
