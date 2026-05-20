import type {
  CodeFile,
  ApiContractIssue,
  ApiEndpoint,
  VersioningCheckResult,
  VersioningStrategy,
} from "../types.js";
import {
  VERSION_PATH_PATTERN,
  VERSION_HEADER_PATTERN,
  VERSION_QUERY_PATTERN,
} from "../types.js";
import { matchPattern, hasPattern, isTestFile, isTypeFile } from "../utils/pattern.matcher.util.js";
import { detectVersioningStrategy } from "../utils/endpoint.parser.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `api-ver-${String(_counter).padStart(4, "0")}`;
}
export function resetVersioningCheckerCounter(): void { _counter = 0; }

function buildVersioningIssue(
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

function detectMissingVersioning(
  endpoints: readonly ApiEndpoint[],
  strategy:  VersioningStrategy,
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  if (strategy === "NONE" && endpoints.length > 0) {
    const publicEndpoints = endpoints.filter(
      (e) => !e.route.includes("/internal") && !e.route.includes("/health") && !e.route.includes("/metrics"),
    );

    if (publicEndpoints.length >= 3) {
      const firstEp = publicEndpoints[0];
      if (firstEp) {
        issues.push(buildVersioningIssue(
          "VERSIONING_ABSENT",
          "HIGH",
          firstEp.filePath,
          firstEp.line,
          null,
          "NO_API_VERSION",
          `${publicEndpoints.length} public endpoint(s) have no API versioning — breaking changes will impact all clients immediately.`,
          "Add version prefix to API routes (e.g., /v1/users). Consider URL path versioning for REST APIs.",
          firstEp.rawSnippet,
        ));
      }
    }
  }

  return Object.freeze(issues);
}

function detectMixedVersioningStrategy(
  files:     readonly CodeFile[],
  endpoints: readonly ApiEndpoint[],
  strategy:  VersioningStrategy,
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  if (strategy !== "MIXED") return Object.freeze([]);

  const pathVersioned   = endpoints.filter((e) => e.version !== null);
  const unversioned     = endpoints.filter((e) => e.version === null && !e.route.includes("/internal"));

  const mixedFiles = new Set([
    ...pathVersioned.map((e) => e.filePath),
    ...unversioned.map((e) => e.filePath),
  ]);

  let issuesAdded = 0;
  for (const filePath of mixedFiles) {
    if (issuesAdded >= 3) break;
    const filePathVersioned = pathVersioned.filter((e) => e.filePath === filePath);
    const fileUnversioned   = unversioned.filter((e) => e.filePath === filePath);

    if (filePathVersioned.length > 0 && fileUnversioned.length > 0) {
      issues.push(buildVersioningIssue(
        "MIXED_VERSIONING_STRATEGY",
        "MEDIUM",
        filePath,
        fileUnversioned[0]?.line ?? null,
        null,
        "MIXED_VERSIONING",
        `File mixes versioned (${filePathVersioned.length}) and unversioned (${fileUnversioned.length}) endpoints — inconsistent API contract.`,
        "Apply a consistent versioning strategy to all endpoints. Either version all routes or none.",
      ));
      issuesAdded++;
    }
  }

  if (issues.length === 0 && mixedFiles.size > 0) {
    const firstFile = [...mixedFiles][0] ?? "";
    issues.push(buildVersioningIssue(
      "MIXED_VERSIONING_STRATEGY",
      "MEDIUM",
      firstFile,
      null,
      null,
      "MIXED_VERSIONING_GLOBAL",
      `API uses mixed versioning: ${pathVersioned.length} path-versioned endpoint(s) alongside ${unversioned.length} unversioned endpoint(s).`,
      "Standardize on a single versioning strategy (URL path versioning recommended for REST APIs).",
    ));
  }

  return Object.freeze(issues);
}

function detectVersionInconsistencies(
  endpoints: readonly ApiEndpoint[],
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  const versionGroups = new Map<string, ApiEndpoint[]>();
  for (const ep of endpoints) {
    if (!ep.version) continue;
    const list = versionGroups.get(ep.version) ?? [];
    list.push(ep);
    versionGroups.set(ep.version, list);
  }

  const versions = [...versionGroups.keys()].sort();
  if (versions.length <= 1) return Object.freeze([]);

  const resourcesByVersion = new Map<string, Set<string>>();
  for (const [ver, eps] of versionGroups.entries()) {
    const resources = new Set(eps.map((e) => {
      const segs = e.route.replace(/\/v\d+/, "").split("/").filter((s) => s && !s.startsWith(":"));
      return segs[0] ?? "";
    }));
    resourcesByVersion.set(ver, resources);
  }

  const latestVersion  = versions[versions.length - 1] ?? "";
  const latestResources = resourcesByVersion.get(latestVersion) ?? new Set();

  for (const [ver, resources] of resourcesByVersion.entries()) {
    if (ver === latestVersion) continue;
    for (const resource of resources) {
      if (!latestResources.has(resource)) {
        const ep = (versionGroups.get(ver) ?? []).find((e) => e.route.includes(resource));
        if (!ep) continue;
        issues.push(buildVersioningIssue(
          "VERSIONING_INCONSISTENT",
          "MEDIUM",
          ep.filePath,
          ep.line,
          `${ep.method} ${ep.route}`,
          "VERSION_RESOURCE_DRIFT",
          `Resource '${resource}' exists in ${ver} but not in ${latestVersion} — version drift detected.`,
          "Ensure all resources are present across active API versions, or explicitly document deprecated endpoints.",
          ep.rawSnippet,
        ));
      }
    }
  }

  return Object.freeze(issues);
}

function detectHeaderVersioning(
  files: readonly CodeFile[],
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  for (const file of files) {
    const hasHeaderVer = hasPattern(file.content, VERSION_HEADER_PATTERN);
    const hasPathVer   = hasPattern(file.content, /\/v\d+\//g);

    if (hasHeaderVer && hasPathVer) {
      issues.push(buildVersioningIssue(
        "MIXED_VERSIONING_STRATEGY",
        "LOW",
        file.path,
        null,
        null,
        "MIXED_VERSION_MECHANISM",
        "File uses both header-based and URL path versioning — two competing version signals.",
        "Standardize on a single versioning mechanism. URL path versioning is most widely understood.",
      ));
    }
  }

  return Object.freeze(issues);
}

export function checkVersioning(
  files:     readonly CodeFile[],
  endpoints: readonly ApiEndpoint[],
): VersioningCheckResult {
  const allIssues: ApiContractIssue[] = [];
  let filesScanned    = 0;
  let versionedCount  = 0;
  let unversionedCount = 0;

  const strategy = detectVersioningStrategy(endpoints);

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;
    filesScanned += 1;
  }

  for (const ep of endpoints) {
    if (ep.version) versionedCount++;
    else            unversionedCount++;
  }

  allIssues.push(
    ...detectMissingVersioning(endpoints, strategy),
    ...detectMixedVersioningStrategy(files, endpoints, strategy),
    ...detectVersionInconsistencies(endpoints),
    ...detectHeaderVersioning(files),
  );

  return Object.freeze({
    issues:          Object.freeze(allIssues),
    filesScanned,
    strategy,
    versionedCount,
    unversionedCount,
  });
}

export function versioningIssueCount(result: Readonly<VersioningCheckResult>): number {
  return result.issues.length;
}
