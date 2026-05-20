let matrixCounter  = 0;
let sessionCounter = 0;

export function nextMatrixId(): string {
  matrixCounter += 1;
  return `acm-${matrixCounter}-${Date.now()}`;
}

export function nextSessionId(): string {
  sessionCounter += 1;
  return `acs-${sessionCounter}-${Date.now()}`;
}

export function resetCounters(): void {
  matrixCounter  = 0;
  sessionCounter = 0;
}

export function sanitizeId(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "UNKNOWN";
  return raw.trim().replace(/[^a-zA-Z0-9_\-.]/g, "_");
}

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "Unnamed Agent";
  return raw.trim();
}

export function normalizeToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}
