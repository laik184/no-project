/**
 * server/agents/coordination/types.ts — STUB
 */

export interface GateRequest {
  runId:     string;
  projectId: number;
  nodeId:    string;
  dependsOn: string[];
}

export interface GateResult {
  nodeId:   string;
  decision: "allow" | "block" | "hold";
  reason:   string;
}

export interface CoordinationSyncRequest {
  runId:     string;
  projectId: number;
  nodeId:    string;
  status:    "completed" | "failed";
  output?:   string;
}
