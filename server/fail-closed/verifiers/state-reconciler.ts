/**
 * server/fail-closed/verifiers/state-reconciler.ts
 *
 * StateReconciler — Stage 5 of the fail-closed pipeline.
 *
 * Compares the claimed postconditions from the CompletionProposal against
 * verified runtime reality gathered by previous stages.
 *
 * RULE: "I think I completed it" is NOT a postcondition.
 * Postconditions must be deterministically provable from evidence.
 *
 * Evidence produced:
 *   POSTCONDITIONS_MET
 */

import type {
  StageResult,
  Evidence,
  CompletionProposal,
} from "../contracts/types.ts";

const SOURCE = "state-reconciler";

// Known verifiable postconditions and how to evaluate them
type PostconditionCheck = {
  pattern: RegExp;
  requiredEvidence: string[];
  description: string;
};

const KNOWN_POSTCONDITIONS: PostconditionCheck[] = [
  {
    pattern: /server (is |)running|process alive/i,
    requiredEvidence: ["PROCESS_ALIVE", "NO_CRASH_LOOP"],
    description: "server running",
  },
  {
    pattern: /typescript (is |)(valid|passes|compiles)/i,
    requiredEvidence: ["TSC_EXIT_0"],
    description: "TypeScript valid",
  },
  {
    pattern: /imports (are |)(valid|clean|working)/i,
    requiredEvidence: ["IMPORT_GRAPH_CLEAN"],
    description: "imports valid",
  },
  {
    pattern: /preview (is |)(working|loading|visible)/i,
    requiredEvidence: ["PREVIEW_DOM_VALID", "HTTP_200_STABLE"],
    description: "preview working",
  },
  {
    pattern: /dependencies (are |)(installed|intact)/i,
    requiredEvidence: ["NPM_DEPS_INTACT"],
    description: "dependencies installed",
  },
];

export class StateReconciler {

  verify(
    proposal: CompletionProposal,
    priorEvidence: readonly Evidence[],
  ): StageResult {
    const t0 = Date.now();
    const evidence: Evidence[] = [];
    const failedConditions: string[] = [];

    const priorEvidenceByKind = new Map(priorEvidence.map((e) => [e.kind, e]));

    for (const claimed of proposal.claimedPostconditions) {
      const check = this._findCheck(claimed);

      if (!check) {
        // Unrecognized postcondition — treat as unverifiable = failed (fail-closed)
        failedConditions.push(`Unverifiable postcondition: "${claimed}"`);
        continue;
      }

      const missingEvidence = check.requiredEvidence.filter((kind) => {
        const ev = priorEvidenceByKind.get(kind as Evidence["kind"]);
        return !ev || !ev.value;
      });

      if (missingEvidence.length > 0) {
        failedConditions.push(
          `"${check.description}" not satisfied — missing evidence: ${missingEvidence.join(", ")}`
        );
      }
    }

    const passed = failedConditions.length === 0;

    evidence.push({
      kind:        "POSTCONDITIONS_MET",
      value:       passed,
      detail:      passed
        ? `All ${proposal.claimedPostconditions.length} postcondition(s) satisfied`
        : `${failedConditions.length} postcondition(s) failed: ${failedConditions[0]}`,
      collectedAt: Date.now(),
      source:      SOURCE,
      ttlMs:       30_000,
    });

    if (!passed) {
      return Object.freeze({
        stage:         "STATE_RECONCILIATION" as const,
        passed:        false,
        evidence:      Object.freeze(evidence),
        failureReason: failedConditions.join("; "),
        durationMs:    Date.now() - t0,
      });
    }

    return Object.freeze({
      stage:         "STATE_RECONCILIATION" as const,
      passed:        true,
      evidence:      Object.freeze(evidence),
      failureReason: null,
      durationMs:    Date.now() - t0,
    });
  }

  private _findCheck(postcondition: string): PostconditionCheck | null {
    return KNOWN_POSTCONDITIONS.find((c) => c.pattern.test(postcondition)) ?? null;
  }

  /** Returns unverifiable postconditions from a proposal. */
  auditProposal(proposal: CompletionProposal): readonly string[] {
    return proposal.claimedPostconditions.filter(
      (p) => !this._findCheck(p)
    );
  }
}
