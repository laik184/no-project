/**
 * visual-diff-detector.ts
 * ONLY responsible for comparing screenshots to detect visual regressions.
 * Uses byte-level buffer comparison — no external dependencies.
 */

import fs                                  from 'fs';
import type { VisualDiffResult }           from '../../../shared/browser/types/validation.types.ts';
import { buildBaselinePath,
         readScreenshotBuffer,
         saveBaseline }                    from '../../../shared/browser/utils/screenshot-utils.ts';
import { browserLogger }                   from '../../../shared/browser/telemetry/browser-logger.ts';

const DEFAULT_DIFF_THRESHOLD = 0.05; // 5% size deviation allowed

export function compareScreenshots(
  runId:      string,
  label:      string,
  currentPath: string,
  threshold = DEFAULT_DIFF_THRESHOLD,
): VisualDiffResult {
  const baselinePath = buildBaselinePath(runId, label);

  if (!fs.existsSync(baselinePath)) {
    // No baseline — save current as baseline, no diff
    const saved = saveBaseline(currentPath, baselinePath);
    browserLogger.info(runId, `Visual baseline saved for: ${label}`, { path: baselinePath });
    return { hasChanges: false, baselineExists: false, threshold, diffScore: 0, detail: saved ? 'Baseline created' : 'Baseline save failed' };
  }

  const current  = readScreenshotBuffer(currentPath);
  const baseline = readScreenshotBuffer(baselinePath);

  if (!current || !baseline) {
    browserLogger.warn(runId, `Visual diff failed — could not read buffers for: ${label}`);
    return { hasChanges: false, baselineExists: true, threshold, detail: 'Buffer read failed' };
  }

  // Byte-level diff score based on size deviation + sampled byte differences
  const sizeDiff = Math.abs(current.length - baseline.length) / Math.max(baseline.length, 1);
  const sampleCount = Math.min(current.length, baseline.length, 1000);
  let diffBytes = 0;
  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.floor((i / sampleCount) * Math.min(current.length, baseline.length));
    if (current[idx] !== baseline[idx]) diffBytes++;
  }

  const byteDiffRatio = diffBytes / sampleCount;
  const diffScore     = (sizeDiff + byteDiffRatio) / 2;
  const hasChanges    = diffScore > threshold;

  if (hasChanges) {
    browserLogger.warn(runId, `Visual regression detected for: ${label}`, {
      diffScore: diffScore.toFixed(3),
      threshold,
    });
  }

  return { hasChanges, baselineExists: true, threshold, diffScore };
}

export function resetBaseline(runId: string, label: string): boolean {
  const baselinePath = buildBaselinePath(runId, label);
  try {
    fs.unlinkSync(baselinePath);
    return true;
  } catch {
    return false;
  }
}
