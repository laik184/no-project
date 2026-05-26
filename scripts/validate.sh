#!/usr/bin/env bash
# =============================================================================
# scripts/validate.sh — Fail-Closed CI/CD Validation Pipeline
#
# Runs all validation gates in order. Exits non-zero on ANY failure.
# Gate order:
#   1. TypeScript compilation check
#   2. Unit tests
#   3. Integration tests
#   4. Runtime tests
#   5. Orchestration tests
#   6. Parallel/race-condition tests
#   7. Recovery tests
#   8. Telemetry tests
#   9. Memory tests
#   10. Security tests
#   11. Preview tests
#   12. Replay tests
#   13. Full test suite + coverage threshold
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED_GATES=()
PASS_COUNT=0
FAIL_COUNT=0
START_TIME=$(date +%s)

gate() {
  local name="$1"; shift
  echo -e "\n${BLUE}━━━ Gate: ${name} ━━━${NC}"
  if "$@"; then
    echo -e "${GREEN}✅ PASS — ${name}${NC}"
    ((PASS_COUNT++)) || true
  else
    echo -e "${RED}❌ FAIL — ${name}${NC}"
    FAILED_GATES+=("$name")
    ((FAIL_COUNT++)) || true
  fi
}

# ── Gate 1: TypeScript compilation ────────────────────────────────────────────
gate "TypeScript compilation" \
  npx tsc --noEmit --project tsconfig.json

# ── Gate 2: Unit tests ────────────────────────────────────────────────────────
gate "Unit tests" \
  npx vitest run --config test/vitest.config.ts \
    test/unit/

# ── Gate 3: Integration tests ─────────────────────────────────────────────────
gate "Integration tests" \
  npx vitest run --config test/vitest.config.ts \
    test/integration/

# ── Gate 4: Runtime tests ─────────────────────────────────────────────────────
gate "Runtime tests" \
  npx vitest run --config test/vitest.config.ts \
    test/runtime/

# ── Gate 5: Orchestration tests ───────────────────────────────────────────────
gate "Orchestration tests" \
  npx vitest run --config test/vitest.config.ts \
    test/orchestration/

# ── Gate 6: Parallel / race-condition tests ───────────────────────────────────
gate "Parallel execution tests" \
  npx vitest run --config test/vitest.config.ts \
    test/parallel/

# ── Gate 7: Recovery tests ────────────────────────────────────────────────────
gate "Recovery tests" \
  npx vitest run --config test/vitest.config.ts \
    test/recovery/

# ── Gate 8: Telemetry tests ───────────────────────────────────────────────────
gate "Telemetry tests" \
  npx vitest run --config test/vitest.config.ts \
    test/telemetry/

# ── Gate 9: Memory tests ──────────────────────────────────────────────────────
gate "Memory tests" \
  npx vitest run --config test/vitest.config.ts \
    test/memory/

# ── Gate 10: Security tests ───────────────────────────────────────────────────
gate "Security tests" \
  npx vitest run --config test/vitest.config.ts \
    test/security/

# ── Gate 11: Preview tests ────────────────────────────────────────────────────
gate "Preview lifecycle tests" \
  npx vitest run --config test/vitest.config.ts \
    test/preview/

# ── Gate 12: Replay tests ─────────────────────────────────────────────────────
gate "Deterministic replay tests" \
  npx vitest run --config test/vitest.config.ts \
    test/replay/

# ── Gate 13: Full suite + coverage ────────────────────────────────────────────
gate "Full test suite + coverage thresholds" \
  npx vitest run --config test/vitest.config.ts \
    --coverage

# ── Summary ───────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CI/CD VALIDATION SUMMARY — NURA-X${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Duration:  ${DURATION}s"
echo -e "  Passed:    ${GREEN}${PASS_COUNT}${NC}"
echo -e "  Failed:    ${RED}${FAIL_COUNT}${NC}"

if [ ${#FAILED_GATES[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}  FAILED GATES:${NC}"
  for g in "${FAILED_GATES[@]}"; do
    echo -e "    ${RED}✗ ${g}${NC}"
  done
  echo ""
  echo -e "${RED}  ❌ PIPELINE BLOCKED — deployment prevented${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}  ✅ ALL GATES PASSED — safe to deploy${NC}"
  exit 0
fi
