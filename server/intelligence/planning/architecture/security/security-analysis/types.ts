export type SecurityIssueType =
  | "AUTH_LAYER_VIOLATION"
  | "MISSING_AUTH_GUARD"
  | "UNPROTECTED_ROUTE"
  | "SECRET_EXPOSURE"
  | "HARDCODED_CREDENTIAL"
  | "ENV_SECRET_IN_LOG"
  | "SQL_INJECTION_RISK"
  | "XSS_VULNERABILITY"
  | "COMMAND_INJECTION_RISK"
  | "PATH_TRAVERSAL_RISK"
  | "RBAC_VIOLATION"
  | "MISSING_ROLE_CHECK"
  | "PRIVILEGE_ESCALATION_RISK"
  | "INSECURE_DIRECT_OBJECT_REF";

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type SecurityPhase =
  | "IDLE"
  | "AUTH_ENFORCEMENT"
  | "SECRETS_DETECTION"
  | "INJECTION_SCANNING"
  | "RBAC_VALIDATION"
  | "REPORT_GENERATION"
  | "COMPLETE";

export type CodeLanguage = "typescript" | "javascript" | "unknown";

export interface CodeFile {
  readonly id:       string;
  readonly path:     string;
  readonly content:  string;
  readonly language: CodeLanguage;
}

export interface SecurityIssue {
  readonly id:         string;
  readonly type:       SecurityIssueType;
  readonly severity:   SecuritySeverity;
  readonly filePath:   string;
  readonly line:       number | null;
  readonly column:     number | null;
  readonly message:    string;
  readonly rule:       string;
  readonly suggestion: string;
  readonly snippet:    string | null;
  readonly cwe:        string | null;
}

export interface AuthEnforcementResult {
  readonly issues:       readonly SecurityIssue[];
  readonly filesScanned: number;
  readonly unprotectedRoutes: readonly string[];
}

export interface SecretsDetectionResult {
  readonly issues:       readonly SecurityIssue[];
  readonly filesScanned: number;
  readonly exposedSecretTypes: readonly string[];
}

export interface InjectionScanResult {
  readonly issues:       readonly SecurityIssue[];
  readonly filesScanned: number;
  readonly sqlRiskCount: number;
  readonly xssRiskCount: number;
}

export interface RbacValidationResult {
  readonly issues:       readonly SecurityIssue[];
  readonly filesScanned: number;
  readonly missingRoleChecks: number;
}

export interface IntermediateSecurityIssues {
  readonly authIssues:     readonly SecurityIssue[];
  readonly secretIssues:   readonly SecurityIssue[];
  readonly injectionIssues: readonly SecurityIssue[];
  readonly rbacIssues:     readonly SecurityIssue[];
  readonly builtAt:        number;
}

export interface SecurityReport {
  readonly reportId:             string;
  readonly analyzedAt:           number;
  readonly totalFiles:           number;
  readonly totalIssues:          number;
  readonly issues:               readonly SecurityIssue[];
  readonly authViolationCount:   number;
  readonly secretExposureCount:  number;
  readonly injectionRiskCount:   number;
  readonly rbacViolationCount:   number;
  readonly criticalCount:        number;
  readonly highCount:            number;
  readonly mediumCount:          number;
  readonly lowCount:             number;
  readonly overallScore:         number;
  readonly isSecure:             boolean;
  readonly summary:              string;
}

export interface SecuritySession {
  readonly sessionId:  string;
  readonly phase:      SecurityPhase;
  readonly startedAt:  number;
  readonly fileCount:  number;
}

export const SEC_SCORE_START   = 100;
export const MAX_SEC_ISSUES    = 1000;

export const SEC_DEDUCTIONS = Object.freeze<Record<SecuritySeverity, number>>({
  CRITICAL: 30,
  HIGH:     20,
  MEDIUM:    8,
  LOW:       3,
});

export const AUTH_MIDDLEWARE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /authenticate\s*[,(]/g,
  /isAuthenticated\s*[,(]/g,
  /requireAuth\s*[,(]/g,
  /authMiddleware\s*[,(]/g,
  /verifyToken\s*[,(]/g,
  /passport\.authenticate\s*\(/g,
  /jwtMiddleware\s*[,(]/g,
  /bearerAuth\s*[,(]/g,
  /checkAuth\s*[,(]/g,
  /guardRoute\s*[,(]/g,
  /withAuth\s*[,(]/g,
  /protectedRoute\s*[,(]/g,
]);

export const ROUTE_DEFINITION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /router\.(get|post|put|patch|delete|all)\s*\(\s*['"`][^'"`,]+['"`]/g,
  /app\.(get|post|put|patch|delete|all)\s*\(\s*['"`][^'"`,]+['"`]/g,
  /fastify\.(get|post|put|patch|delete)\s*\(\s*['"`][^'"`,]+['"`]/g,
  /Route\s*\(\s*\{[^}]*path\s*:/g,
  /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]/g,
]);

export const SECRET_PATTERNS = Object.freeze<ReadonlyArray<{ rx: RegExp; label: string; cwe: string }>>([
  { rx: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,             label: "HARDCODED_PASSWORD",   cwe: "CWE-798" },
  { rx: /(?:api_?key|apikey)\s*[:=]\s*['"][A-Za-z0-9+/=_\-]{16,}['"]/gi,  label: "HARDCODED_API_KEY",    cwe: "CWE-798" },
  { rx: /(?:secret|secretkey|secret_?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,   label: "HARDCODED_SECRET",     cwe: "CWE-798" },
  { rx: /(?:token|auth_?token|access_?token)\s*[:=]\s*['"][^'"]{16,}['"]/gi, label: "HARDCODED_TOKEN",    cwe: "CWE-798" },
  { rx: /(?:private_?key|privatekey)\s*[:=]\s*['"][^'"]{8,}['"]/gi,        label: "HARDCODED_PRIVATE_KEY",cwe: "CWE-321" },
  { rx: /(?:jdbc|mongodb|mysql|postgres|redis):\/\/[^'">\s]{10,}/g,         label: "CONNECTION_STRING",    cwe: "CWE-312" },
  { rx: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,                        label: "EMBEDDED_PRIVATE_KEY", cwe: "CWE-321" },
  { rx: /AWS_SECRET_ACCESS_KEY\s*[:=]\s*['"]?[A-Za-z0-9+/]{40}['"]?/g,    label: "AWS_SECRET",           cwe: "CWE-798" },
  { rx: /sk_live_[A-Za-z0-9]{24,}/g,                                        label: "STRIPE_SECRET_KEY",    cwe: "CWE-798" },
  { rx: /ghp_[A-Za-z0-9]{36}/g,                                             label: "GITHUB_TOKEN",         cwe: "CWE-798" },
]);

export const LOG_SECRET_PATTERNS = Object.freeze<readonly RegExp[]>([
  /console\.(log|debug|info|warn|error)\s*\([^)]*(?:password|token|secret|key|credential)[^)]*\)/gi,
  /logger\.(log|debug|info|warn|error)\s*\([^)]*(?:password|token|secret|key|credential)[^)]*\)/gi,
  /winston\..*\([^)]*(?:password|token|secret)[^)]*\)/gi,
  /process\.env\.[A-Z_]+.*console\.log/g,
]);

export const SQL_INJECTION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /query\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g,
  /query\s*\(\s*['"][^'"]*['"\s]*\+\s*\w+/g,
  /execute\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g,
  /db\.raw\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g,
  /knex\.raw\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g,
  /sequelize\.query\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g,
  /WHERE\s+\w+\s*=\s*['"]?\s*\+\s*(?:req|request|params|body|query)\./gi,
  /SELECT.*FROM.*WHERE.*\$\{(?:req|request|params|body|query)\./gi,
]);

export const XSS_PATTERNS = Object.freeze<readonly RegExp[]>([
  /innerHTML\s*=\s*(?!['"`]<)/g,
  /outerHTML\s*=\s*(?!['"`]<)/g,
  /document\.write\s*\(/g,
  /eval\s*\(\s*(?!['"`])/g,
  /dangerouslySetInnerHTML\s*=\s*\{\s*\{/g,
  /new\s+Function\s*\(/g,
  /setTimeout\s*\(\s*(?:req|res|body|params|query|user)/g,
  /setInterval\s*\(\s*(?:req|res|body|params|query|user)/g,
  /res\.send\s*\([^)]*(?:req\.body|req\.params|req\.query)[^)]*\)/g,
  /res\.write\s*\([^)]*(?:req\.body|req\.params|req\.query)[^)]*\)/g,
]);

export const COMMAND_INJECTION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /exec\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g,
  /spawn\s*\(\s*[^,]+,\s*\[[^\]]*\$\{[^}]+\}[^\]]*\]\s*\)/g,
  /execSync\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g,
  /shell\s*:\s*true/g,
  /child_process.*\$\{(?:req|body|params|query)/g,
]);

export const PATH_TRAVERSAL_PATTERNS = Object.freeze<readonly RegExp[]>([
  /readFile\s*\(\s*[^'"`,)]*(?:req\.|params\.|query\.|body\.)/g,
  /join\s*\([^)]*(?:req\.|params\.|query\.|body\.)[^)]*\)/g,
  /resolve\s*\([^)]*(?:req\.|params\.|query\.|body\.)[^)]*\)/g,
  /fs\.\w+\s*\(\s*[^'"`,)]*(?:req\.|params\.|query\.)/g,
]);

export const RBAC_ROLE_CHECK_PATTERNS = Object.freeze<readonly RegExp[]>([
  /hasRole\s*\(/g,
  /checkRole\s*\(/g,
  /requireRole\s*\(/g,
  /isAdmin\s*[(\s]/g,
  /user\.role\s*===?\s*['"`]/g,
  /roles\.includes\s*\(/g,
  /can\s*\(\s*['"`]/g,
  /ability\.can\s*\(/g,
  /authorize\s*\(/g,
  /permission\s*\.\s*check\s*\(/g,
  /@Roles\s*\(/g,
  /Guards\s*\(/g,
]);

export const ADMIN_ENDPOINT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /['"`]\/admin[/'"`]/g,
  /['"`]\/api\/admin[/'"`]/g,
  /['"`]\/internal[/'"`]/g,
  /['"`]\/management[/'"`]/g,
  /['"`]\/dashboard[/'"`]/g,
  /['"`]\/superuser[/'"`]/g,
]);
