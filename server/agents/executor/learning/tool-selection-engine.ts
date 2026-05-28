/**
 * server/agents/executor/learning/tool-selection-engine.ts
 *
 * Adaptive tool selection. Overlays learned confidence scores on top of
 * static tool-coordinator routing. NEVER bypasses dispatcher — only advises
 * which static tool name should be preferred for a given kind/subKind.
 */

import type { TaskKind } from '../types/executor.types.ts';
import { learningStore }    from './learning-store.ts';
import { learningGovernor } from './learning-governor.ts';
import { patternLearner }   from './pattern-learner.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolOutcome {
  toolName:   string;
  kind:       TaskKind;
  subKind:    string;
  success:    boolean;
  retries:    number;
  durationMs: number;
}

export interface ToolSelectionResult {
  toolName:         string;
  confidence:       number;         // [0.1, 0.95]
  wasAdapted:       boolean;        // true if learning overrode static default
  fallbackTool?:    string;
  rationale:        string;
}

// ── Static fallback tables (mirrors tool-coordinator without coupling) ────────

const FALLBACKS: Partial<Record<TaskKind, Record<string, string>>> = {
  terminal:   { install: 'npm_install',       build: 'npm_build',     test: 'npm_test'     },
  filesystem: { write:   'write_file',        read:  'read_file',     patch: 'patch_file'  },
  coding:     { generate_component: 'coding_generate_react_component'                       },
  verify:     { runtime: 'validate_runtime',  build: 'run_build',     health: 'check_server_health' },
  browser:    { screenshot: 'browser_screenshot', health: 'browser_health'                   },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function _confidenceKey(toolName: string): string  { return `confidence::${toolName}`; }
function _latencyKey(toolName: string): string      { return `latency::${toolName}`;   }
function _altKey(kind: TaskKind, subKind: string): string { return `alt::${kind}::${subKind}`; }

// ── Module API ────────────────────────────────────────────────────────────────

export const toolSelectionEngine = {
  /**
   * Select the best tool for a kind/subKind.
   * Returns the static tool name if learned confidence is insufficient.
   * NEVER creates new tool names — only selects from known static names.
   */
  selectBestTool(
    kind:            TaskKind,
    subKind:         string,
    defaultToolName: string,
  ): ToolSelectionResult {
    const defaultConf = learningStore.getValue('tool-reliability', `tool::${defaultToolName}`, 0.5);

    // Check if there's a learned alternative for this kind/subKind
    const altEntry = learningStore.get('tool-reliability', _altKey(kind, subKind));
    const altTool  = altEntry ? String(altEntry.metadata?.toolName ?? '') : '';
    const altConf  = altEntry?.value ?? 0;

    // If alt has meaningfully higher confidence AND sufficient evidence
    if (altTool && altTool !== defaultToolName && altConf > defaultConf + 0.15 && (altEntry?.evidence ?? 0) >= 3) {
      return {
        toolName:    altTool,
        confidence:  altConf,
        wasAdapted:  true,
        fallbackTool: defaultToolName,
        rationale:   `Adapted: "${altTool}" conf=${(altConf * 100).toFixed(0)}% ` +
                     `beats "${defaultToolName}" conf=${(defaultConf * 100).toFixed(0)}%`,
      };
    }

    // Use default, but warn if confidence is low
    const rationale = defaultConf < 0.35
      ? `Low confidence (${(defaultConf * 100).toFixed(0)}%) for "${defaultToolName}" — consider fallback`
      : `Using "${defaultToolName}" (conf=${(defaultConf * 100).toFixed(0)}%)`;

    return {
      toolName:   defaultToolName,
      confidence: defaultConf,
      wasAdapted: false,
      rationale,
    };
  },

  /**
   * Record the outcome of a tool execution — updates reliability + latency scores.
   */
  recordToolOutcome(outcome: ToolOutcome): void {
    const { toolName, kind, subKind, success, retries, durationMs } = outcome;

    // Reliability update
    const delta    = success ? (retries === 0 ? 0.05 : 0.02) : (retries >= 3 ? -0.08 : -0.04);
    const current  = learningStore.getValue('tool-reliability', `tool::${toolName}`, 0.5);
    const evidence = (learningStore.get('tool-reliability', `tool::${toolName}`)?.evidence ?? 0) + 1;
    const verdict  = learningGovernor.permitUpdate(`tool::${toolName}`, current, delta, evidence);

    if (verdict.permitted) {
      learningStore.upsert('tool-reliability', `tool::${toolName}`, verdict.actualDelta, {
        toolName, kind, lastSuccess: String(success), lastRetries: retries,
      });
    }

    // If successful + no retries, record as a viable alt for this subKind
    if (success && retries === 0) {
      const altKey     = _altKey(kind, subKind);
      const altCurrent = learningStore.getValue('tool-reliability', altKey, 0.0);
      const altEvidence = (learningStore.get('tool-reliability', altKey)?.evidence ?? 0) + 1;
      const altVerdict  = learningGovernor.permitUpdate(altKey, altCurrent, 0.05, altEvidence);
      if (altVerdict.permitted) {
        learningStore.upsert('tool-reliability', altKey, altVerdict.actualDelta, { toolName, kind, subKind });
      }
    }

    // Latency tracking (normalised: <5s=good, >30s=bad)
    const latencyScore = durationMs < 5_000 ? 0.05 : durationMs > 30_000 ? -0.05 : 0;
    if (latencyScore !== 0) {
      const latKey      = _latencyKey(toolName);
      const latCurrent  = learningStore.getValue('execution-quality', latKey, 0.5);
      const latEvidence = (learningStore.get('execution-quality', latKey)?.evidence ?? 0) + 1;
      const latVerdict  = learningGovernor.permitUpdate(latKey, latCurrent, latencyScore, latEvidence);
      if (latVerdict.permitted) {
        learningStore.upsert('execution-quality', latKey, latVerdict.actualDelta, { toolName, avgMs: durationMs });
      }
    }
  },

  /** Current confidence score for a tool [0.1, 0.95]. */
  getToolConfidence(toolName: string): number {
    return learningStore.getValue('tool-reliability', `tool::${toolName}`, 0.5);
  },

  /** All tools below a confidence threshold. */
  unreliableTools(threshold = 0.4): Array<{ toolName: string; confidence: number }> {
    return learningStore.byKind('tool-reliability')
      .filter(e => e.value < threshold && e.key.startsWith('tool::'))
      .map(e => ({
        toolName:   String(e.metadata?.toolName ?? e.key.replace('tool::', '')),
        confidence: e.value,
      }))
      .sort((a, b) => a.confidence - b.confidence);
  },

  /** Snapshot of all learned tool confidences. */
  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of learningStore.byKind('tool-reliability')) {
      if (e.key.startsWith('tool::')) {
        out[e.key.replace('tool::', '')] = e.value;
      }
    }
    return out;
  },
};
