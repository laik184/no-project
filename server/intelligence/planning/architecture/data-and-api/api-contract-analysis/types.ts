export type ApiContractIssueType =
  | "INCONSISTENT_NAMING_CONVENTION"
  | "MISSING_HTTP_METHOD_ALIGNMENT"
  | "RESOURCE_NAMING_VIOLATION"
  | "MISSING_REQUEST_SCHEMA"
  | "MISSING_RESPONSE_SCHEMA"
  | "SCHEMA_TYPE_MISMATCH"
  | "UNDOCUMENTED_FIELD"
  | "VERSIONING_ABSENT"
  | "VERSIONING_INCONSISTENT"
  | "MIXED_VERSIONING_STRATEGY"
  | "BREAKING_FIELD_REMOVAL"
  | "BREAKING_TYPE_CHANGE"
  | "BREAKING_STATUS_CODE_CHANGE"
  | "BREAKING_ROUTE_REMOVAL"
  | "NON_STANDARD_STATUS_CODE";

export type ContractSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ApiContractPhase =
  | "IDLE"
  | "ENDPOINT_CONSISTENCY"
  | "SCHEMA_VALIDATION"
  | "VERSIONING_CHECK"
  | "BREAKING_CHANGE_DETECTION"
  | "REPORT_GENERATION"
  | "COMPLETE";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "ALL" | "OPTIONS" | "HEAD";

export type VersioningStrategy = "PATH" | "HEADER" | "QUERY_PARAM" | "NONE" | "MIXED";

export interface CodeFile {
  readonly id:       string;
  readonly path:     string;
  readonly content:  string;
}

export interface ApiEndpoint {
  readonly id:          string;
  readonly filePath:    string;
  readonly method:      HttpMethod;
  readonly route:       string;
  readonly version:     string | null;
  readonly line:        number | null;
  readonly hasAuth:     boolean;
  readonly hasSchema:   boolean;
  readonly rawSnippet:  string | null;
}

export interface ApiContractIssue {
  readonly id:         string;
  readonly type:       ApiContractIssueType;
  readonly severity:   ContractSeverity;
  readonly filePath:   string;
  readonly line:       number | null;
  readonly endpoint:   string | null;
  readonly message:    string;
  readonly rule:       string;
  readonly suggestion: string;
  readonly snippet:    string | null;
}

export interface EndpointConsistencyResult {
  readonly issues:           readonly ApiContractIssue[];
  readonly filesScanned:     number;
  readonly endpointsFound:   number;
  readonly endpoints:        readonly ApiEndpoint[];
}

export interface SchemaValidationResult {
  readonly issues:           readonly ApiContractIssue[];
  readonly filesScanned:     number;
  readonly missingSchemas:   number;
}

export interface VersioningCheckResult {
  readonly issues:            readonly ApiContractIssue[];
  readonly filesScanned:      number;
  readonly strategy:          VersioningStrategy;
  readonly versionedCount:    number;
  readonly unversionedCount:  number;
}

export interface BreakingChangeResult {
  readonly issues:             readonly ApiContractIssue[];
  readonly filesScanned:       number;
  readonly breakingChangeCount: number;
}

export interface IntermediateContractIssues {
  readonly consistencyIssues: readonly ApiContractIssue[];
  readonly schemaIssues:      readonly ApiContractIssue[];
  readonly versioningIssues:  readonly ApiContractIssue[];
  readonly breakingIssues:    readonly ApiContractIssue[];
  readonly builtAt:           number;
}

export interface ApiContractReport {
  readonly reportId:              string;
  readonly analyzedAt:            number;
  readonly totalFiles:            number;
  readonly totalEndpoints:        number;
  readonly totalIssues:           number;
  readonly issues:                readonly ApiContractIssue[];
  readonly consistencyCount:      number;
  readonly schemaViolationCount:  number;
  readonly versioningIssueCount:  number;
  readonly breakingChangeCount:   number;
  readonly criticalCount:         number;
  readonly highCount:             number;
  readonly mediumCount:           number;
  readonly lowCount:              number;
  readonly versioningStrategy:    VersioningStrategy;
  readonly overallScore:          number;
  readonly isCompliant:           boolean;
  readonly summary:               string;
}

export interface ApiContractSession {
  readonly sessionId:  string;
  readonly phase:      ApiContractPhase;
  readonly startedAt:  number;
  readonly fileCount:  number;
}

export const CONTRACT_SCORE_START = 100;
export const MAX_CONTRACT_ISSUES  = 1000;

export const CONTRACT_DEDUCTIONS = Object.freeze<Record<ContractSeverity, number>>({
  CRITICAL: 25,
  HIGH:     15,
  MEDIUM:    7,
  LOW:       3,
});

export const ROUTE_DEFINITION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /(?:router|app)\.(get|post|put|patch|delete|all|options)\s*\(\s*['"`]([^'"`,]+)['"`]/g,
  /fastify\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`,]+)['"`]/g,
  /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]([^'"`,]*)['"`]/g,
  /Route\s*\(\s*['"`]([^'"`,]+)['"`]\s*,\s*\{\s*method\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/g,
]);

export const SCHEMA_VALIDATION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\.validate\s*\(\s*(?:req|request)/g,
  /joi\.\w+/g,
  /z\.\w+\s*\(/g,
  /yup\.\w+/g,
  /ajv\.\w+/g,
  /body\s*:\s*\{/g,
  /schema\s*:\s*\{/g,
  /@Body\s*\(/g,
  /@Query\s*\(/g,
  /@Param\s*\(/g,
  /validateBody\s*\(/g,
  /validateRequest\s*\(/g,
]);

export const VERSION_PATH_PATTERN    = /\/v(\d+)\//g;
export const VERSION_HEADER_PATTERN  = /['"`]?api-?version['"`]?\s*[:=]/gi;
export const VERSION_QUERY_PATTERN   = /\?version=|\bversion\b.*query/gi;

export const SNAKE_CASE_RX    = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
export const KEBAB_CASE_RX    = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const CAMEL_CASE_RX    = /^[a-z][a-zA-Z0-9]*$/;
export const PLURAL_NOUN_RX   = /s$/;

export const RESTFUL_METHOD_RESOURCE_MAP = Object.freeze<Partial<Record<HttpMethod, string[]>>>({
  GET:    ["list", "get", "fetch", "read", "retrieve", "show"],
  POST:   ["create", "add", "register", "submit", "upload"],
  PUT:    ["update", "replace", "set"],
  PATCH:  ["update", "modify", "patch", "edit"],
  DELETE: ["delete", "remove", "destroy"],
});

export const STANDARD_SUCCESS_CODES = Object.freeze<readonly number[]>([
  200, 201, 202, 204, 206,
]);

export const STANDARD_ERROR_CODES = Object.freeze<readonly number[]>([
  400, 401, 403, 404, 409, 422, 429, 500, 502, 503,
]);
