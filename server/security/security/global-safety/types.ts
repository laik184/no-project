export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SafetyDecision = "ALLOW" | "BLOCK";

export interface SafetyInput {
  action: string;
  context?: string;
  chain?: string[];
  isAdmin?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface ThreatReport {
  detected: boolean;
  threats: string[];
  severity: RiskLevel;
  matchedPatterns: string[];
}

export interface ChainRisk {
  hasCompoundingRisk: boolean;
  compoundScore: number;
  flaggedSteps: string[];
  reason: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  pattern: RegExp;
  riskLevel: RiskLevel;
  description: string;
  blockByDefault: boolean;
}

export interface PolicyResult {
  allowed: boolean;
  violatedPolicies: PolicyRule[];
  appliedPolicies: PolicyRule[];
  reason: string;
}

export interface OverrideResult {
  overrideGranted: boolean;
  reason: string;
}

export interface SafetyResult {
  success: boolean;
  logs: string[];
  error?: string;
  decision?: SafetyDecision;
  riskScore?: number;
  riskLevel?: RiskLevel;
  threats?: string[];
  blockedBy?: string;
}
