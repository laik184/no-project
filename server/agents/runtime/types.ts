/**
 * server/agents/runtime/types.ts — STUB
 */

export type RuntimeObservationTrigger = "manual" | "scheduled" | "post-deploy" | "crash";

export interface RuntimeObservationResult {
  status:   "healthy" | "degraded" | "crashed" | "unknown";
  port?:    number;
  uptime?:  number;
  logs?:    string[];
  message?: string;
}
