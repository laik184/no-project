import type {
  CodeFile,
  ApiContractIssue,
  ApiEndpoint,
  SchemaValidationResult,
} from "../types.js";
import { SCHEMA_VALIDATION_PATTERNS } from "../types.js";
import { matchPattern, hasPattern, isTestFile, isTypeFile } from "../utils/pattern.matcher.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `api-schema-${String(_counter).padStart(4, "0")}`;
}
export function resetSchemaValidatorCounter(): void { _counter = 0; }

function buildSchemaIssue(
  type:       ApiContractIssue["type"],
  severity:   ApiContractIssue["severity"],
  filePath:   string,
  line:       number | null,
  endpoint:   string | null,
  rule:       string,
  message:    string,
  suggestion: string,
  snippet:    string | null = null,
): ApiContractIssue {
  return Object.freeze({ id: nextId(), type, severity, filePath, line, endpoint, message, rule, suggestion, snippet });
}

function fileHasSchemaValidation(content: string): boolean {
  return SCHEMA_VALIDATION_PATTERNS.some((rx) => hasPattern(content, rx));
}

function detectMissingRequestSchemas(
  file:      Readonly<CodeFile>,
  endpoints: readonly ApiEndpoint[],
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  const mutatingEndpoints = endpoints.filter(
    (e) => e.filePath === file.path && (e.method === "POST" || e.method === "PUT" || e.method === "PATCH"),
  );

  if (mutatingEndpoints.length === 0) return Object.freeze([]);

  const hasSchema = fileHasSchemaValidation(file.content);
  if (hasSchema) return Object.freeze([]);

  for (const ep of mutatingEndpoints.slice(0, 5)) {
    issues.push(buildSchemaIssue(
      "MISSING_REQUEST_SCHEMA",
      "HIGH",
      file.path,
      ep.line,
      `${ep.method} ${ep.route}`,
      "MISSING_REQUEST_VALIDATION",
      `${ep.method} ${ep.route} has no request body schema validation — unvalidated input accepted.`,
      "Add schema validation using Zod, Joi, or class-validator. Validate all request body fields before processing.",
      ep.rawSnippet,
    ));
  }

  return Object.freeze(issues);
}

function detectMissingResponseSchemas(
  file: Readonly<CodeFile>,
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  const hasResponseSchema =
    /res\.json\s*\(\s*\{[^}]{3,}\}/.test(file.content) ||
    /@ApiResponse\s*\(/.test(file.content) ||
    /responseSchema\s*[:=]/.test(file.content) ||
    /returns?\s*:\s*\[/.test(file.content);

  if (hasResponseSchema) return Object.freeze([]);

  const responseHits = matchPattern(file.content, /res\.json\s*\(\s*\w+\s*\)/g);
  for (const hit of responseHits.slice(0, 3)) {
    const surrounding = file.content
      .split("\n")
      .slice(Math.max(0, (hit.line ?? 1) - 5), (hit.line ?? 1) + 2)
      .join("\n");

    const hasTypeAnnotation = /:\s*\w+Response|ResponseDto|ResponseSchema/.test(surrounding);
    if (hasTypeAnnotation) continue;

    issues.push(buildSchemaIssue(
      "MISSING_RESPONSE_SCHEMA",
      "MEDIUM",
      file.path,
      hit.line,
      null,
      "MISSING_RESPONSE_SCHEMA",
      "Response sent without a documented schema — API clients cannot reliably know the response shape.",
      "Define response DTOs/schemas and annotate endpoints with expected response types (@ApiResponse, Zod schemas).",
      hit.snippet,
    ));
  }

  return Object.freeze(issues);
}

function detectSchemaTypeMismatch(file: Readonly<CodeFile>): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  const unsafeParseRx = [
    { rx: /parseInt\s*\(\s*(?:req\.body|req\.params|req\.query)\.\w+/g,   field: "integer" },
    { rx: /parseFloat\s*\(\s*(?:req\.body|req\.params|req\.query)\.\w+/g, field: "float" },
    { rx: /JSON\.parse\s*\(\s*(?:req\.body|req\.params|req\.query)\.\w+/g, field: "JSON" },
  ];

  for (const { rx, field } of unsafeParseRx) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      const surrounding = file.content
        .split("\n")
        .slice(Math.max(0, (hit.line ?? 1) - 2), (hit.line ?? 1) + 2)
        .join("\n");

      const isSafe = /try\s*\{|isNaN|isFinite|Number\.isInteger/.test(surrounding);
      if (isSafe) continue;

      issues.push(buildSchemaIssue(
        "SCHEMA_TYPE_MISMATCH",
        "HIGH",
        file.path,
        hit.line,
        null,
        "UNSAFE_TYPE_COERCION",
        `Unsafe ${field} coercion from user input without schema validation — invalid input may cause NaN/errors.`,
        `Validate input type at the schema level (Zod z.number(), Joi.number()) before coercing.`,
        hit.snippet,
      ));
    }
  }

  return Object.freeze(issues);
}

function detectUndocumentedFields(file: Readonly<CodeFile>): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  const directBodyAccessRx = /req\.body\.\w+(?!\s*=)/g;
  const hits = matchPattern(file.content, directBodyAccessRx);
  const directFields = new Set(hits.map((h) => h.matched.replace("req.body.", "")));

  if (directFields.size === 0) return Object.freeze([]);

  const hasSchemaForAll = fileHasSchemaValidation(file.content);
  if (hasSchemaForAll) return Object.freeze([]);

  if (directFields.size > 3) {
    issues.push(buildSchemaIssue(
      "UNDOCUMENTED_FIELD",
      "MEDIUM",
      file.path,
      hits[0]?.line ?? null,
      null,
      "UNDOCUMENTED_REQUEST_FIELDS",
      `${directFields.size} request body fields accessed directly (${[...directFields].slice(0, 3).join(", ")}...) without schema documentation.`,
      "Define a request DTO or schema that explicitly lists all expected fields with their types.",
      hits[0]?.snippet ?? null,
    ));
  }

  return Object.freeze(issues);
}

export function validateSchemas(
  files:     readonly CodeFile[],
  endpoints: readonly ApiEndpoint[],
): SchemaValidationResult {
  const allIssues: ApiContractIssue[] = [];
  let filesScanned  = 0;
  let missingSchemas = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    const requestIssues  = detectMissingRequestSchemas(file, endpoints);
    const responseIssues = detectMissingResponseSchemas(file);
    const typeIssues     = detectSchemaTypeMismatch(file);
    const fieldIssues    = detectUndocumentedFields(file);

    missingSchemas += requestIssues.length + responseIssues.length;
    allIssues.push(...requestIssues, ...responseIssues, ...typeIssues, ...fieldIssues);
  }

  return Object.freeze({
    issues:         Object.freeze(allIssues),
    filesScanned,
    missingSchemas,
  });
}

export function schemaIssueCount(result: Readonly<SchemaValidationResult>): number {
  return result.issues.length;
}
