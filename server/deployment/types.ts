export type DeployStatus =
  | "queued"
  | "building"
  | "deploying"
  | "running"
  | "failed"
  | "stopped"
  | "sleeping";

export type DeploymentTier = "static" | "autoscale" | "reserved";

export interface Deployment {
  id: string;
  projectId: string;
  userId: string;
  status: DeployStatus;
  tier: DeploymentTier;
  url: string;
  customDomain?: string;
  buildLog: string[];
  deployedAt?: Date;
  stoppedAt?: Date;
  createdAt: Date;
}

export interface DeployConfig {
  projectId: string;
  tier: DeploymentTier;
  envVars: Record<string, string>;
  buildCommand?: string;
  runCommand: string;
  port: number;
  healthCheckPath?: string;
}

export interface BuildResult {
  success: boolean;
  logs: string[];
  imageTag?: string;
  error?: string;
  durationMs: number;
}

export interface DomainRecord {
  id: string;
  deploymentId: string;
  domain: string;
  status: "pending" | "active" | "failed";
  sslStatus: "pending" | "issued" | "failed";
  createdAt: Date;
}

export interface DeploymentMetrics {
  deploymentId: string;
  requestsPerMin: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  uptimePercent: number;
}

export interface RollbackPayload {
  deploymentId: string;
  targetDeploymentId: string;
  reason?: string;
}
