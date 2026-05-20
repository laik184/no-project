import type { ApiContractIssue, CodeFile } from "../types.js";
import { matchPattern } from "../utils/pattern.matcher.util.js";
import { buildBreakingIssue } from "./breaking-issue-builder.util.js";

export function detectRemovedFields(file: Readonly<CodeFile>): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const deprecatedRx = [
    /\/\*\*?[^*]*@deprecated[^*]*\*\//gi,
    /\/\/\s*(?:DEPRECATED|deprecated|REMOVED|removed):/g,
    /delete\s+(?:this|obj|response|data|result)\.\w+/g,
  ];

  for (const rx of deprecatedRx) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      const surrounding = file.content
        .split("\n")
        .slice(Math.max(0, (hit.line ?? 1) - 3), (hit.line ?? 1) + 3)
        .join("\n");

      const hasVersionGuard = /v\d+|version|deprecated.*version|migration/i.test(surrounding);

      issues.push(
        buildBreakingIssue(
          "BREAKING_FIELD_REMOVAL",
          hasVersionGuard ? "MEDIUM" : "HIGH",
          file.path,
          hit.line,
          null,
          "FIELD_DEPRECATION_RISK",
          "Deprecated/removed field detected — existing API clients depending on this field will break.",
          "Do not remove fields in the same API version. Add deprecated flag and remove only in next major version.",
          hit.snippet,
        ),
      );
    }
  }

  return Object.freeze(issues);
}

export function detectBreakingTypeChanges(file: Readonly<CodeFile>): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const coercionRx = [
    {
      rx: /String\s*\(\s*(?:req\.body|req\.params|req\.query)\.\w+\s*\)/g,
      message:
        "Coercing request field to String — if API previously accepted number, this is a breaking type change.",
    },
    {
      rx: /Number\s*\(\s*(?:req\.body|req\.params|req\.query)\.\w+\s*\)/g,
      message:
        "Coercing request field to Number — if API previously accepted string, clients sending strings will receive NaN.",
    },
    {
      rx: /Boolean\s*\(\s*(?:req\.body|req\.params|req\.query)\.\w+\s*\)/g,
      message:
        "Coercing to Boolean may silently accept any truthy/falsy value — breaks strict type contracts.",
    },
  ];

  for (const { rx, message } of coercionRx) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 3)) {
      const surrounding = file.content
        .split("\n")
        .slice(Math.max(0, (hit.line ?? 1) - 2), (hit.line ?? 1) + 2)
        .join("\n");

      const isValidated = /validate|schema|z\.|joi\.|Joi\./.test(surrounding);
      if (isValidated) continue;

      issues.push(
        buildBreakingIssue(
          "BREAKING_TYPE_CHANGE",
          "MEDIUM",
          file.path,
          hit.line,
          null,
          "IMPLICIT_TYPE_COERCION",
          message,
          "Define explicit type contracts in your schema validation layer. Never rely on implicit JS coercion for API fields.",
          hit.snippet,
        ),
      );
    }
  }

  return Object.freeze(issues);
}

export function detectRequiredFieldAdditions(file: Readonly<CodeFile>): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const requiredFieldRx =
    /(?:required\s*:\s*true|\.required\s*\(\s*\)|z\.\w+\s*\(\s*\)(?:\.trim\(\))?\.min\s*\()/g;
  const hits = matchPattern(file.content, requiredFieldRx);

  for (const hit of hits.slice(0, 5)) {
    const surrounding = file.content
      .split("\n")
      .slice(Math.max(0, (hit.line ?? 1) - 5), (hit.line ?? 1) + 2)
      .join("\n");

    const hasVersionComment = /v\d+|new in|added|since/.test(surrounding);
    const hasDefaultValue = /default\s*:|\.default\s*\(/.test(surrounding);

    if (hasDefaultValue) continue;
    if (hasVersionComment) continue;

    issues.push(
      buildBreakingIssue(
        "BREAKING_FIELD_REMOVAL",
        "LOW",
        file.path,
        hit.line,
        null,
        "POTENTIAL_REQUIRED_FIELD_ADDITION",
        "Required field detected without default value — if this is a new field on existing endpoint, existing clients will receive validation errors.",
        "Provide default values for newly required fields, or bump the API version when adding required fields.",
        hit.snippet,
      ),
    );
  }

  return Object.freeze(issues);
}
