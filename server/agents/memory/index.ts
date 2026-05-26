/**
 * server/agents/memory/index.ts — STUB
 * Memory agent was removed. Provides no-op MemoryManager.
 */

export class MemoryManager {
  private static instances = new Map<number, MemoryManager>();

  static for(projectId: number): MemoryManager {
    if (!this.instances.has(projectId)) {
      this.instances.set(projectId, new MemoryManager(projectId));
    }
    return this.instances.get(projectId)!;
  }

  private constructor(private projectId: number) {}

  async loadContext(_opts?: { runId?: string; goal?: string }): Promise<string | null> { return null; }
  async saveRunSummary(_runId: string, _goal: string, _result: unknown): Promise<void> {}
  async persistConversation(_runId: string, _goal: string, _messages: unknown): Promise<void> {}
  async trackTaskOutcome(_runId: string | { runId: string; goal: string; success: boolean; maxStepsReached: boolean }, _goal?: string, _result?: unknown): Promise<void> {}

  async appendDecisionMd(_content: string): Promise<void> {}
  async appendProgressMd(_content: string): Promise<void> {}
  async appendFailedAttemptMd(_content: string): Promise<void> {}
  async getArchitecture(): Promise<string> { return ""; }
  async setArchitecture(_content: string): Promise<void> {}
  async getProgressMd(): Promise<string> { return ""; }
  async getDecisionsMd(): Promise<string> { return ""; }
  async getFailedAttemptsMd(): Promise<string> { return ""; }
  async getTasksMd(): Promise<string> { return ""; }
  async getRecentRuns(_n: number): Promise<unknown[]> { return []; }
}
