/**
 * screenshot-analysis.ts
 * Analyses browser screenshots for UI errors and blank-screen conditions.
 * Currently text-based — screenshot path stored for future vision-model integration.
 */

export interface ScreenshotAnalysis {
  hasContent:     boolean;
  likelyBlank:    boolean;
  screenshotPath: string;
  note:           string;
}

/**
 * Analyse a screenshot file. Currently heuristic (file-size based).
 * Future: pass image to a vision model for richer analysis.
 */
export async function analyzeScreenshot(
  screenshotPath: string,
): Promise<ScreenshotAnalysis> {
  if (!screenshotPath) {
    return { hasContent: false, likelyBlank: true, screenshotPath: '', note: 'No screenshot available' };
  }

  let sizeBytes = 0;
  try {
    const { stat } = await import('fs/promises');
    const s = await stat(screenshotPath);
    sizeBytes = s.size;
  } catch {
    return {
      hasContent:     false,
      likelyBlank:    true,
      screenshotPath,
      note:           'Screenshot file not found or unreadable',
    };
  }

  // A mostly-blank page produces a very small PNG (<5 KB)
  const likelyBlank = sizeBytes < 5_000;

  return {
    hasContent:     sizeBytes > 1_000,
    likelyBlank,
    screenshotPath,
    note: likelyBlank
      ? `Screenshot is very small (${sizeBytes}B) — page may be blank or crashed`
      : `Screenshot captured (${sizeBytes}B)`,
  };
}

export function formatScreenshotAnalysis(analysis: ScreenshotAnalysis): string {
  return analysis.note;
}
