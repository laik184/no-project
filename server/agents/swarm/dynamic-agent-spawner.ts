/**
 * server/agents/swarm/dynamic-agent-spawner.ts — STUB
 * Swarm agent was removed.
 */

export interface SpawnedAgent {
  agentId:   string;
  role:      string;
  task:      string;
  waveIndex: number;
}

export async function spawnWaveAgents(
  _waveIndex: number,
  _tasks: unknown[],
  _opts: { runId: string; projectId: number },
): Promise<SpawnedAgent[]> {
  console.warn("[dynamic-agent-spawner] Swarm agent removed — returning empty spawn list.");
  return [];
}
