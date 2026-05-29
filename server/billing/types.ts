export type PlanId = "free" | "hacker" | "pro" | "teams_starter" | "teams_business";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  limits: PlanLimits;
  features: string[];
}

export interface PlanLimits {
  storageGb: number;
  memoryGb: number;
  cpuCores: number;
  deployments: number;
  customDomains: number;
  teamMembers: number;
  privateRepls: number;
  aiRequestsPerDay: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: PlanId;
  status: "active" | "cancelled" | "past_due" | "trialing";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface UsageRecord {
  userId: string;
  projectId?: string;
  metric: UsageMetric;
  value: number;
  unit: string;
  recordedAt: Date;
}

export type UsageMetric =
  | "storage_bytes"
  | "compute_minutes"
  | "ai_tokens_input"
  | "ai_tokens_output"
  | "bandwidth_bytes"
  | "deployments_count"
  | "domain_count";

export interface UsageSummary {
  userId: string;
  period: { start: Date; end: Date };
  storage: { used: number; limit: number; unit: "GB" };
  compute: { used: number; limit: number; unit: "hours" };
  aiTokens: { input: number; output: number; limit: number };
  bandwidth: { used: number; limit: number; unit: "GB" };
}

export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  period: { start: Date; end: Date };
  lineItems: Array<{ description: string; amount: number }>;
  paidAt?: Date;
  pdfUrl?: string;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: "card" | "bank_transfer";
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}
