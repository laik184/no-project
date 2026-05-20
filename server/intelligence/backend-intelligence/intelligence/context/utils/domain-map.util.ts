import type { BusinessDomain, NormalizedSignals } from "../types.js";

const DOMAIN_PATTERN_MAP: ReadonlyArray<readonly [RegExp, BusinessDomain]> = Object.freeze([
  [/payment|kyc|wallet|ledger|pci|fraud|debit|credit|forex|trading|banking|fintech|investment|portfolio/i, "Fintech"],
  [/cart|checkout|order|inventory|catalog|sku|shipment|fulfillment|ecommerce|storefront|merchant/i,        "Ecommerce"],
  [/websocket|socket\.io|pubsub|stream|mqtt|realtime|live-update|sse|event-driven/i,                       "Realtime"],
  [/patient|ehr|emr|hipaa|prescription|appointment|diagnosis|clinical|telemedicine|doctor|nurse/i,         "Healthcare"],
  [/employee|payroll|attendance|recruitment|onboarding|hr[ms]|hris|leave|roster|appraisal/i,               "HR"],
  [/student|enrollment|course|lms|lesson|quiz|curriculum|instructor|grade|elearning|mooc/i,                 "Education"],
  [/shipment|carrier|freight|dispatch|routing|logistics|fleet|driver|vehicle|manifest|parcel/i,             "Logistics"],
  [/leaderboard|player|achievement|quest|guild|character|gaming|multiplayer|loot|match-making/i,            "Gaming"],
  [/sensor|telemetry|firmware|gateway|mqtt|device-registry|ota|actuator|iot|thing|shadow/i,                "IoT"],
  [/contract|clause|litigation|case-matter|attorney|counsel|legal|arbitration|statute|deposition/i,        "Legal"],
  [/property|listing|mortgage|lease|tenant|landlord|mls|realestate|real-estate|escrow|appraisal/i,         "RealEstate"],
  [/cms|article|editorial|podcast|streaming|content-management|publishing|broadcast|media/i,               "Media"],
  [/crm|lead|opportunity|pipeline|prospect|sales-rep|quota|renewal|upsell|cross-sell/i,                    "CRM"],
  [/bin|barcode|warehouse|stock-level|reorder|purchase-order|sku-management|inventory/i,                   "Inventory"],
  [/marketplace|two-sided|escrow-marketplace|seller-onboarding|buyer-protection|bidding/i,                 "Marketplace"],
  [/project|sprint|epic|kanban|backlog|milestone|standup|scrum|jira|trello|agile/i,                        "ProjectManagement"],
  [/post|follow|feed|like|mention|hashtag|community|social-network|forum|reaction/i,                       "Social"],
  [/booking|reservation|slot|availability|hotel|check-in|check-out|appointment-booking/i,                  "Booking"],
  [/analytics|dashboard|funnel|cohort|kpi|metric|dimension|bi-report|data-warehouse|etl/i,                 "Analytics"],
  [/role|permission|jwt|oauth|sso|ldap|saml|identity|mfa|otp|session-management|iam/i,                     "Auth"],
  [/multi-tenant|saas|subscription|feature-flag|metering|plan|workspace|organization|mrr|arr/i,             "SaaS"],
]);

const DOMAIN_SECURITY_RISK: Readonly<Record<BusinessDomain, "low" | "medium" | "high">> = Object.freeze({
  Fintech:           "high",
  Healthcare:        "high",
  Marketplace:       "high",
  Auth:              "high",
  SaaS:              "medium",
  Ecommerce:         "medium",
  Legal:             "medium",
  HR:                "medium",
  IoT:               "medium",
  Realtime:          "medium",
  Logistics:         "low",
  Gaming:            "low",
  Education:         "low",
  RealEstate:        "low",
  Media:             "low",
  CRM:               "low",
  Inventory:         "low",
  ProjectManagement: "low",
  Social:            "low",
  Booking:           "low",
  Analytics:         "low",
  Custom:            "medium",
});

export function pickDomain(signals: NormalizedSignals): BusinessDomain {
  const tokens = [
    ...signals.dependencies,
    ...signals.configKeys,
    ...signals.filePaths,
  ].join(" ");

  for (const [pattern, domain] of DOMAIN_PATTERN_MAP) {
    if (pattern.test(tokens)) return domain;
  }

  return "Custom";
}

export function getDomainRiskLevel(domain: BusinessDomain): "low" | "medium" | "high" {
  return DOMAIN_SECURITY_RISK[domain] ?? "medium";
}
