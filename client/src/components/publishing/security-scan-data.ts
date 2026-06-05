export type ScanStatus = "idle" | "scanning" | "done";
export type IssueSeverity = "critical" | "medium" | "low";
export type IssueState = "active" | "hidden" | "fixed";
export type SecurityInnerTab = "active" | "hidden" | "settings";

export interface ScanIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  desc: string;
  state: IssueState;
  fixing: boolean;
}

export const SEED_ISSUES: ScanIssue[] = [
  { id: "i1", severity: "critical", title: "SQL Injection Vulnerability",        desc: "User input passed directly into database query without sanitisation.",   state: "active", fixing: false },
  { id: "i2", severity: "critical", title: "Exposed API Secret in Bundle",       desc: "STRIPE_SECRET_KEY detected in client-side JavaScript bundle.",            state: "active", fixing: false },
  { id: "i3", severity: "medium",   title: "Missing Content-Security-Policy",    desc: "No CSP header is set, allowing potential XSS attacks.",                  state: "active", fixing: false },
  { id: "i4", severity: "medium",   title: "Outdated Dependency (axios 0.21)",   desc: "axios@0.21.1 has known SSRF vulnerability — upgrade to ≥1.6.0.",         state: "active", fixing: false },
  { id: "i5", severity: "low",      title: "HTTP Strict Transport Security Off", desc: "HSTS header not present. Connections may fall back to plain HTTP.",       state: "active", fixing: false },
  { id: "i6", severity: "low",      title: "X-Frame-Options Not Set",            desc: "App may be embeddable in iframes, enabling clickjacking.",                state: "active", fixing: false },
];
