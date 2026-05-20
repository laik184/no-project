import type { DomainContext, NormalizedSignals, RiskLevel } from "../types.js";
import { pickDomain, getDomainRiskLevel } from "../utils/domain-map.util.js";

const HIGH_ENDPOINT_MIN = 60;

const PII_PATTERN = /pii|gdpr|hipaa|ssn|credit.card|card.number|dob|date.of.birth|passport|driver.licen/i;

const HIGH_SENSITIVITY_DOMAINS = new Set([
  "Fintech", "Healthcare", "Legal", "HR", "Auth", "Marketplace",
]);

const MEDIUM_SENSITIVITY_DOMAINS = new Set([
  "SaaS", "Ecommerce", "Education", "Booking", "CRM",
]);

function inferRiskLevel(
  signals: NormalizedSignals,
  domain:  DomainContext["domain"],
): RiskLevel {
  const domainRisk = getDomainRiskLevel(domain);
  if (domainRisk === "high") return "high";

  if (signals.endpointCount >= HIGH_ENDPOINT_MIN) return "medium";

  const tokens = [...signals.configKeys, ...signals.filePaths, ...signals.dependencies].join(" ");
  if (PII_PATTERN.test(tokens)) return "high";

  return domainRisk;
}

function inferDataSensitivity(
  domain:  DomainContext["domain"],
  signals: NormalizedSignals,
): DomainContext["dataSensitivity"] {
  if (HIGH_SENSITIVITY_DOMAINS.has(domain)) return "high";

  const tokens = [...signals.configKeys, ...signals.filePaths].join(" ");
  if (PII_PATTERN.test(tokens)) return "high";

  if (MEDIUM_SENSITIVITY_DOMAINS.has(domain)) return "low";

  return "low";
}

export function inferDomainContext(signals: NormalizedSignals): DomainContext {
  const domain = pickDomain(signals);

  return Object.freeze({
    domain,
    riskLevel:       inferRiskLevel(signals, domain),
    dataSensitivity: inferDataSensitivity(domain, signals),
  });
}
