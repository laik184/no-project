/**
 * server/ast/refactors/safe-refactor-engine.ts
 * Validates whether a proposed refactor is safe to apply.
 * Single responsibility: refactor safety evaluation. No filesystem writes.
 */

import { parseAST }      from "../parsers/ast-parser.ts";
import { analyzeImpact } from "../analysis/impact-analyzer.ts";
import type { DependencyMap } from "../analysis/dependency-analyzer.ts";
import type { ASTEditProposal, RefactorImpact } from "../types.ts";

export interface RefactorValidation {
  proposal:    ASTEditProposal;
  impact:      RefactorImpact;
  safe:        boolean;
  blockReason: string | null;
  warnings:    string[];
}

const MAX_SAFE_RISK_SCORE = 60;

async function validateSyntaxIntegrity(
  filePath: string,
  newCode: string,
): Promise<{ valid: boolean; error?: string }> {
  const dummyPath = filePath.replace(/\.(ts|tsx|js|jsx)$/, ".tmp.$1");
  const result = await parseAST(dummyPath, newCode);
  if (result.parseError) return { valid: false, error: result.parseError };
  return { valid: true };
}

function checkImportIntegrity(
  proposal: ASTEditProposal,
  map: DependencyMap,
): string | null {
  if (proposal.operation !== "delete") return null;
  const dependents = map.incoming.get(proposal.filePath);
  if (dependents && dependents.size > 0) {
    return `Cannot delete "${proposal.filePath}" — ${dependents.size} file(s) depend on it.`;
  }
  return null;
}

export async function validateRefactor(
  proposal: ASTEditProposal,
  map: DependencyMap,
): Promise<RefactorValidation> {
  const warnings: string[] = [];

  // 1. Impact analysis
  const impact = analyzeImpact(proposal.filePath, map);

  // 2. Import integrity for deletions
  const importViolation = checkImportIntegrity(proposal, map);
  if (importViolation) {
    return {
      proposal,
      impact: { ...impact, safe: false, reason: importViolation,
        targetFile: proposal.filePath, affectedFiles: impact.directDependents,
        brokenImports: [], symbolsRemoved: [] },
      safe: false,
      blockReason: importViolation,
      warnings,
    };
  }

  // 3. Risk score gate
  if (impact.riskScore > MAX_SAFE_RISK_SCORE) {
    warnings.push(`High impact score (${impact.riskScore}) — review affected files manually.`);
  }

  // 4. Syntax integrity for replacements
  if (proposal.operation === "replace" && proposal.newCode) {
    const syntax = await validateSyntaxIntegrity(proposal.filePath, proposal.newCode);
    if (!syntax.valid) {
      return {
        proposal,
        impact: { targetFile: proposal.filePath, affectedFiles: impact.directDependents,
          brokenImports: [], symbolsRemoved: [], safe: false, reason: syntax.error! },
        safe: false,
        blockReason: `Syntax error in replacement code: ${syntax.error}`,
        warnings,
      };
    }
  }

  const safe = impact.riskScore <= MAX_SAFE_RISK_SCORE;

  return {
    proposal,
    impact: {
      targetFile: proposal.filePath,
      affectedFiles: impact.directDependents,
      brokenImports: [],
      symbolsRemoved: [],
      safe,
      reason: safe ? "Refactor validated." : impact.summary,
    },
    safe,
    blockReason: safe ? null : `Risk score ${impact.riskScore} exceeds threshold ${MAX_SAFE_RISK_SCORE}.`,
    warnings,
  };
}
