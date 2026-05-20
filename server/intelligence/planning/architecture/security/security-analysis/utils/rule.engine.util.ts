import type { SecuritySeverity, SecurityIssueType } from "../types.js";

export interface SecurityRule {
  readonly id:         string;
  readonly type:       SecurityIssueType;
  readonly severity:   SecuritySeverity;
  readonly message:    string;
  readonly suggestion: string;
  readonly cwe:        string | null;
}

export const AUTH_RULES = Object.freeze<Record<string, SecurityRule>>({
  MISSING_AUTH_ON_ROUTE: Object.freeze({
    id:         "AUTH-001",
    type:       "MISSING_AUTH_GUARD",
    severity:   "CRITICAL",
    message:    "Route handler has no authentication middleware — endpoint is publicly accessible.",
    suggestion: "Add authentication middleware (e.g., requireAuth, verifyToken) before the route handler.",
    cwe:        "CWE-306",
  }),
  UNPROTECTED_ADMIN_ROUTE: Object.freeze({
    id:         "AUTH-002",
    type:       "UNPROTECTED_ROUTE",
    severity:   "CRITICAL",
    message:    "Admin/internal route detected without auth guard — privileged endpoint is exposed.",
    suggestion: "Protect all admin/internal routes with authentication AND authorization middleware.",
    cwe:        "CWE-284",
  }),
  AUTH_BYPASS_PATTERN: Object.freeze({
    id:         "AUTH-003",
    type:       "AUTH_LAYER_VIOLATION",
    severity:   "HIGH",
    message:    "Potential auth bypass: early return or conditional skip before auth check.",
    suggestion: "Ensure authentication runs unconditionally as the first middleware in the chain.",
    cwe:        "CWE-287",
  }),
  HARDCODED_AUTH_SKIP: Object.freeze({
    id:         "AUTH-004",
    type:       "AUTH_LAYER_VIOLATION",
    severity:   "CRITICAL",
    message:    "Hardcoded auth skip (e.g., if (true), NODE_ENV check) found in middleware.",
    suggestion: "Remove environment-based auth bypasses from production code paths.",
    cwe:        "CWE-547",
  }),
});

export const SECRET_RULES = Object.freeze<Record<string, SecurityRule>>({
  HARDCODED_CREDENTIAL: Object.freeze({
    id:         "SEC-001",
    type:       "HARDCODED_CREDENTIAL",
    severity:   "CRITICAL",
    message:    "Hardcoded credential/secret found in source code.",
    suggestion: "Move secrets to environment variables. Use a secrets manager (Vault, AWS Secrets Manager).",
    cwe:        "CWE-798",
  }),
  SECRET_IN_LOG: Object.freeze({
    id:         "SEC-002",
    type:       "ENV_SECRET_IN_LOG",
    severity:   "HIGH",
    message:    "Sensitive value (password/token/key) passed to a logging function — will appear in logs.",
    suggestion: "Never log credentials. Redact sensitive fields before logging.",
    cwe:        "CWE-532",
  }),
  PRIVATE_KEY_EMBEDDED: Object.freeze({
    id:         "SEC-003",
    type:       "SECRET_EXPOSURE",
    severity:   "CRITICAL",
    message:    "Private key embedded directly in source code.",
    suggestion: "Store private keys as environment variables or in a secrets manager, never in code.",
    cwe:        "CWE-321",
  }),
});

export const INJECTION_RULES = Object.freeze<Record<string, SecurityRule>>({
  SQL_INJECTION: Object.freeze({
    id:         "INJ-001",
    type:       "SQL_INJECTION_RISK",
    severity:   "CRITICAL",
    message:    "User-controlled input interpolated directly into SQL query — SQL injection risk.",
    suggestion: "Use parameterized queries or prepared statements. Never concatenate user input into SQL.",
    cwe:        "CWE-89",
  }),
  XSS_RISK: Object.freeze({
    id:         "INJ-002",
    type:       "XSS_VULNERABILITY",
    severity:   "HIGH",
    message:    "Unescaped user input rendered into HTML — Cross-Site Scripting (XSS) risk.",
    suggestion: "Sanitize all user input before rendering. Use DOMPurify or framework-level escaping.",
    cwe:        "CWE-79",
  }),
  COMMAND_INJECTION: Object.freeze({
    id:         "INJ-003",
    type:       "COMMAND_INJECTION_RISK",
    severity:   "CRITICAL",
    message:    "User input passed to shell command execution — command injection risk.",
    suggestion: "Never pass user input to exec/spawn directly. Use shell: false and validate input strictly.",
    cwe:        "CWE-78",
  }),
  PATH_TRAVERSAL: Object.freeze({
    id:         "INJ-004",
    type:       "PATH_TRAVERSAL_RISK",
    severity:   "HIGH",
    message:    "User-controlled path used in filesystem operation — path traversal risk.",
    suggestion: "Validate and normalize paths. Use path.resolve() and check the result stays within allowed directory.",
    cwe:        "CWE-22",
  }),
});

export const RBAC_RULES = Object.freeze<Record<string, SecurityRule>>({
  MISSING_ROLE_CHECK: Object.freeze({
    id:         "RBAC-001",
    type:       "MISSING_ROLE_CHECK",
    severity:   "HIGH",
    message:    "Route is authenticated but has no role/permission check — any authenticated user can access.",
    suggestion: "Add role-based access control (e.g., requireRole('admin'), can('read', 'resource')).",
    cwe:        "CWE-285",
  }),
  DIRECT_ROLE_COMPARISON: Object.freeze({
    id:         "RBAC-002",
    type:       "RBAC_VIOLATION",
    severity:   "MEDIUM",
    message:    "Direct string comparison for role check — fragile and error-prone RBAC pattern.",
    suggestion: "Use a centralized permission system or enum-based role checks instead of raw string comparisons.",
    cwe:        "CWE-285",
  }),
  PRIVILEGE_ESCALATION: Object.freeze({
    id:         "RBAC-003",
    type:       "PRIVILEGE_ESCALATION_RISK",
    severity:   "CRITICAL",
    message:    "User can modify their own role/permission field — privilege escalation risk.",
    suggestion: "Never allow users to self-modify role/permission fields. Restrict role assignment to admin operations only.",
    cwe:        "CWE-269",
  }),
  IDOR_RISK: Object.freeze({
    id:         "RBAC-004",
    type:       "INSECURE_DIRECT_OBJECT_REF",
    severity:   "HIGH",
    message:    "Object accessed by ID from user input without ownership check — IDOR risk.",
    suggestion: "Always verify that the requesting user owns or has permission to access the requested resource.",
    cwe:        "CWE-639",
  }),
});
