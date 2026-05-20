import type { RiskLevel, SafetyDecision } from "../types";

export function logEntry(agent: string, message: string): string {
  return `[${agent}] ${message}`;
}

export function logDecision(agent: string, decision: SafetyDecision, reason: string): string {
  return `[${agent}] decision=${decision} — ${reason}`;
}

export function logRisk(agent: string, score: number, level: RiskLevel): string {
  return `[${agent}] riskScore=${score} riskLevel=${level}`;
}

export function logThreat(agent: string, threat: string, severity: RiskLevel): string {
  return `[${agent}] THREAT detected severity=${severity}: ${threat}`;
}

export function logPolicy(agent: string, policyId: string, policyName: string, allowed: boolean): string {
  return `[${agent}] policy=${policyId} "${policyName}" → ${allowed ? "PASS" : "VIOLATION"}`;
}

export function logOverride(agent: string, granted: boolean, reason: string): string {
  return `[${agent}] override=${granted ? "GRANTED" : "DENIED"} — ${reason}`;
}

export function logBlock(agent: string, reason: string): string {
  return `[${agent}] BLOCKED — ${reason}`;
}

export function logAllow(agent: string, reason: string): string {
  return `[${agent}] ALLOWED — ${reason}`;
}
