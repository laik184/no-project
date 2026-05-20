/**
 * patch-validator.ts
 *
 * Lightweight pre-write validation for agent-generated file patches.
 * Catches obviously broken patches before they hit disk.
 *
 * Checks:
 *   1. Content is not empty / whitespace-only
 *   2. JSON files parse correctly
 *   3. JS/TS files don't have unbalanced braces/brackets
 *   4. Content does not exceed a safety size limit
 *
 * Pure function — no I/O, no bus, no state.
 * Ownership: autonomous-debug/patchers — single responsibility: validation.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 512_000; // 512 KB safety cap

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason: string;
}

// ─── Validators ───────────────────────────────────────────────────────────────

function checkNotEmpty(content: string): ValidationResult | null {
  if (content.trim().length === 0) {
    return { valid: false, reason: "Patch content is empty — refusing to overwrite with blank file." };
  }
  return null;
}

function checkSize(content: string): ValidationResult | null {
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    return { valid: false, reason: `Patch exceeds max size (${MAX_FILE_BYTES} bytes).` };
  }
  return null;
}

function checkJson(filePath: string, content: string): ValidationResult | null {
  if (!filePath.endsWith(".json")) return null;
  try {
    JSON.parse(content);
    return null;
  } catch (e: any) {
    return { valid: false, reason: `Invalid JSON in ${filePath}: ${e.message}` };
  }
}

function checkBraceBalance(filePath: string, content: string): ValidationResult | null {
  const ext = filePath.split(".").pop() ?? "";
  if (!["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) return null;

  let curly  = 0;
  let square = 0;
  let paren  = 0;
  let inStr  = false;
  let strChar = "";

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const prev = content[i - 1];

    if (inStr) {
      if (ch === strChar && prev !== "\\") inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = true; strChar = ch; continue; }

    if (ch === "{") curly++;
    else if (ch === "}") curly--;
    else if (ch === "[") square++;
    else if (ch === "]") square--;
    else if (ch === "(") paren++;
    else if (ch === ")") paren--;
  }

  if (curly !== 0) {
    return { valid: false, reason: `Unbalanced curly braces in ${filePath} (delta=${curly}).` };
  }
  if (square !== 0) {
    return { valid: false, reason: `Unbalanced square brackets in ${filePath} (delta=${square}).` };
  }
  if (paren !== 0) {
    return { valid: false, reason: `Unbalanced parentheses in ${filePath} (delta=${paren}).` };
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate a proposed file patch before writing to disk.
 * Returns { valid: true } if all checks pass, or { valid: false, reason } on first failure.
 */
export function validatePatch(filePath: string, content: string): ValidationResult {
  const checks = [
    checkNotEmpty(content),
    checkSize(content),
    checkJson(filePath, content),
    checkBraceBalance(filePath, content),
  ];

  for (const result of checks) {
    if (result !== null) return result;
  }

  return { valid: true, reason: "All validation checks passed." };
}
