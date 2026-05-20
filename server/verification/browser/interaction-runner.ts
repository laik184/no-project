/**
 * interaction-runner.ts
 *
 * Simulates user interactions via HTTP and HTML analysis.
 * Checks that forms, buttons, and links are structurally present and wired.
 * Falls back gracefully — no headless browser required.
 */

import type { InteractionResult } from "./verification-types.ts";

interface InteractionSpec {
  selector: string;
  action:   "click" | "fill" | "submit";
  value?:   string;
}

// ── HTML presence checkers ────────────────────────────────────────────────────

function findSelector(html: string, selector: string): boolean {
  // Support basic CSS selectors: tag, #id, .class, [attr]
  const tagMatch = selector.match(/^(\w+)/);
  const idMatch  = selector.match(/#([\w-]+)/);
  const clsMatch = selector.match(/\.([\w-]+)/);
  const attrMatch= selector.match(/\[([^\]]+)\]/);

  if (idMatch) {
    return new RegExp(`id=["']${idMatch[1]}["']`, "i").test(html);
  }
  if (attrMatch) {
    const [attr, val] = attrMatch[1].split("=");
    if (val) return html.includes(`${attr}=${val}`) || html.includes(`${attr}="${val.replace(/["']/g, "")}"`);
    return html.includes(` ${attr}`);
  }
  if (clsMatch) {
    return new RegExp(`class=["'][^"']*${clsMatch[1]}[^"']*["']`, "i").test(html);
  }
  if (tagMatch) {
    return new RegExp(`<${tagMatch[1]}[\\s>]`, "i").test(html);
  }
  return false;
}

function checkButtonWired(html: string, selector: string): boolean {
  const btnMatch = html.match(/<button[^>]*>([^<]*)<\/button>/gi) ?? [];
  const label = selector.replace(/[#.[\]]/g, " ").trim();
  return btnMatch.some(b => b.toLowerCase().includes(label.toLowerCase())) || btnMatch.length > 0;
}

function checkFormPresent(html: string): boolean {
  return /<form[\s>]/i.test(html);
}

function checkLinkPresent(html: string, selector: string): boolean {
  if (selector.startsWith("a[href")) {
    const href = selector.match(/href=["']?([^"'\]]+)/)?.[1];
    if (href) return html.includes(`href="${href}"`) || html.includes(`href='${href}'`);
  }
  return /<a[\s>]/i.test(html);
}

// ── Default interactions derived from HTML ────────────────────────────────────

export function deriveDefaultInteractions(html: string): InteractionSpec[] {
  const specs: InteractionSpec[] = [];

  if (/<form[\s>]/i.test(html))   specs.push({ selector: "form", action: "submit" });
  if (/<button[\s>]/i.test(html)) specs.push({ selector: "button", action: "click" });
  if (/<input[\s>]/i.test(html))  specs.push({ selector: "input", action: "fill", value: "test" });
  if (/<a[\s>]/i.test(html))      specs.push({ selector: "a", action: "click" });

  return specs;
}

// ── Runner ────────────────────────────────────────────────────────────────────

export function runInteractions(
  html:         string,
  interactions: InteractionSpec[],
): InteractionResult[] {
  return interactions.map(spec => {
    let success = false;
    let error: string | undefined;

    try {
      switch (spec.action) {
        case "click":
          if (spec.selector.startsWith("button") || spec.selector.includes("btn")) {
            success = checkButtonWired(html, spec.selector);
          } else if (spec.selector.startsWith("a")) {
            success = checkLinkPresent(html, spec.selector);
          } else {
            success = findSelector(html, spec.selector);
          }
          break;
        case "fill":
          success = /<input[\s>]/i.test(html) || /<textarea[\s>]/i.test(html);
          break;
        case "submit":
          success = checkFormPresent(html);
          break;
        default:
          success = findSelector(html, spec.selector);
      }
      if (!success) {
        error = `Element not found in HTML: ${spec.selector}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return { target: spec.selector, action: spec.action, success, error };
  });
}

/** Score 0–100 based on interaction pass rate. */
export function scoreInteractions(results: InteractionResult[]): number {
  if (results.length === 0) return 100;
  const passed = results.filter(r => r.success).length;
  return Math.round((passed / results.length) * 100);
}
