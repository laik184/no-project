#!/usr/bin/env node
/**
 * scripts/governance-check.mjs
 *
 * IMPORT BOUNDARY GOVERNANCE ENFORCEMENT
 *
 * Enforces hard architectural boundaries that must never be violated:
 *
 *   FORBIDDEN:
 *     server/tools/...  ->  server/agents/...   (except browser tool layer, see below)
 *     server/tools/...  ->  server/orchestration/...
 *     server/chat/...   ->  server/agents/...   (must go through orchestration)
 *     server/agents/... ->  server/tools/...    (except tools/registry/)
 *
 *   ALLOWED EXCEPTION:
 *     server/tools/browser/... -> server/agents/browser/... (structural coupling, tracked)
 *
 * Run:   node scripts/governance-check.mjs
 * CI:    npm run governance
 *
 * Exit 0 = all clean. Exit 1 = violations found.
 */

import { execSync } from 'node:child_process';

const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

let totalViolations = 0;

/**
 * Run a grep and report any matching import lines as violations.
 * ignorePattern: lines containing this string are excluded (e.g. comments).
 */
function enforceRule(ruleName, grepCommand, ignorePatterns = []) {
  let output = '';
  try {
    output = execSync(grepCommand, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    // grep exits 1 when no matches found — that is the desired outcome
    return;
  }

  if (!output) return;

  const lines = output.split('\n').filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // Skip pure comment lines
    if (/^\s*(\/\/|\*|#)/.test(trimmed)) return false;
    // Skip lines where the import keyword is in a comment
    if (/\/\/.*import/.test(trimmed) && !/^[^/]*import/.test(trimmed)) return false;
    // Apply caller-supplied ignore patterns
    for (const pat of ignorePatterns) {
      if (pat.test(line)) return false;
    }
    return true;
  });

  if (lines.length === 0) return;

  console.error(`\n${RED}${BOLD}[GOVERNANCE VIOLATION]${RESET} ${CYAN}${ruleName}${RESET}`);
  lines.forEach(l => console.error(`  ${YELLOW}${l}${RESET}`));
  totalViolations += lines.length;
}

console.log(`\n${BOLD}=== NURA-X Import Boundary Governance Check ===${RESET}\n`);

// ── Rule 1: Non-browser tools must not import from agents ─────────────────────
enforceRule(
  'Rule 1: server/tools/ (non-browser) must not import from server/agents/',
  `grep -rn "from.*['\\\"].*\\/agents\\/" server/tools/ --include="*.ts"`,
  [/server\/tools\/browser\//],  // browser tool layer has documented structural coupling
);

// ── Rule 2: Chat layer must not import from agents directly ───────────────────
enforceRule(
  'Rule 2: server/chat/ must not import from server/agents/ (route through server/orchestration/)',
  `grep -rn "from.*['\\\"].*\\/agents\\/" server/chat/ --include="*.ts"`,
);

// ── Rule 3: Agents must not import tool implementations (only registry/) ──────
enforceRule(
  'Rule 3: server/agents/ must not import tool implementations — only tools/registry/ and tools/shared/ are allowed',
  `grep -rn "from.*['\\\"].*\\/tools\\/" server/agents/ --include="*.ts"`,
  [
    /tools\/registry\//,  // tools/registry/ is the approved dispatch gateway
    /tools\/shared\//,    // tools/shared/ is the neutral utility area (string-utils, etc.)
  ],
);

// ── Rule 4: Tools must not import from orchestration ─────────────────────────
enforceRule(
  'Rule 4: server/tools/ must not import from server/orchestration/',
  `grep -rn "from.*['\\\"].*\\/orchestration\\/" server/tools/ --include="*.ts"`,
);

// ── Rule 5: Agents must not import from shared/types via tool-types directly ──
enforceRule(
  'Rule 5: server/agents/ should import ToolExecutionContext from shared/types/execution-contracts — not tools/registry/tool-types directly',
  `grep -rn "from.*tools\\/registry\\/tool-types" server/agents/ --include="*.ts"`,
);

// ── Rule 6: No dispatcher bypass — agents must use dispatcher-client only ─────
enforceRule(
  'Rule 6: server/agents/ must not import tool-dispatcher directly (use coordination/dispatcher-client.ts)',
  `grep -rn "from.*tools\\/registry\\/tool-dispatcher" server/agents/ --include="*.ts"`,
  [/coordination\/dispatcher-client\.ts/],  // dispatcher-client.ts itself is allowed to import it
);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
if (totalViolations === 0) {
  console.log(`${GREEN}${BOLD}✓ All import boundary governance checks passed.${RESET}\n`);
  process.exit(0);
} else {
  console.error(`${RED}${BOLD}✗ ${totalViolations} governance violation(s) detected.${RESET}`);
  console.error(`${YELLOW}  Fix violations before committing. See server/shared/types/ for shared contracts.${RESET}\n`);
  process.exit(1);
}
