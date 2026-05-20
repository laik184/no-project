/**
 * dom-validator.ts
 *
 * Analyzes raw HTML to detect blank pages, React errors,
 * hydration failures, and missing UI content.
 * HTTP-based — no browser binary required.
 */

import type { DomReport } from "./verification-types.ts";

// ── Patterns ──────────────────────────────────────────────────────────────────

const REACT_ERROR_PATTERNS = [
  /error boundary/i,
  /something went wrong/i,
  /application error/i,
  /minified react error/i,
  /hydration failed/i,
  /text content does not match/i,
  /cannot read propert/i,
];

const BLANK_PATTERNS = [
  /^<html[^>]*>\s*<head[^>]*>[\s\S]*?<\/head>\s*<body[^>]*>\s*<\/body>/i,
  /<body[^>]*>\s*<\/body>/i,
  /<body[^>]*>\s*<div[^>]*>\s*<\/div>\s*<\/body>/i,
];

const COUNT_TAG = (html: string, tag: string) => {
  const re = new RegExp(`<${tag}[\\s>]`, "gi");
  return (html.match(re) ?? []).length;
};

// ── Extractor helpers ─────────────────────────────────────────────────────────

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function extractBodyText(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function extractErrorMessages(html: string): string[] {
  const errors: string[] = [];
  for (const pattern of REACT_ERROR_PATTERNS) {
    const m = html.match(pattern);
    if (m) errors.push(m[0].slice(0, 100));
  }
  return [...new Set(errors)];
}

// ── Main validator ─────────────────────────────────────────────────────────────

export function validateDom(html: string): DomReport {
  const title      = extractTitle(html);
  const bodyText   = extractBodyText(html);
  const errorMsgs  = extractErrorMessages(html);
  const hasReact   = errorMsgs.length > 0;

  const isBlank = bodyText.length < 20 ||
    BLANK_PATTERNS.some(p => p.test(html)) ||
    /<body[^>]*>\s*(<noscript>[\s\S]*?<\/noscript>)?\s*<\/body>/i.test(html);

  const hasWhiteScreen = isBlank && !hasReact;

  return {
    title,
    bodyText,
    isBlank,
    hasReactError:  hasReact,
    hasWhiteScreen,
    headingCount:   COUNT_TAG(html, "h[1-6]"),
    buttonCount:    COUNT_TAG(html, "button"),
    inputCount:     COUNT_TAG(html, "input"),
    linkCount:      COUNT_TAG(html, "a"),
    imageCount:     COUNT_TAG(html, "img"),
    errorMessages:  errorMsgs,
  };
}

/** Score 0–100 based on DOM health. */
export function scoreDom(report: DomReport): number {
  let score = 100;
  if (report.isBlank)       score -= 60;
  if (report.hasReactError) score -= 40;
  if (report.hasWhiteScreen)score -= 30;
  if (report.errorMessages.length > 0) score -= 10 * Math.min(report.errorMessages.length, 3);
  if (report.bodyText.length < 50)     score -= 10;
  return Math.max(0, score);
}
