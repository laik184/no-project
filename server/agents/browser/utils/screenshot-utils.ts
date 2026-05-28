/**
 * server/agents/browser/utils/screenshot-utils.ts
 * Screenshot directory and path utilities.
 * NOTE: No Playwright usage here — pure file-system helpers.
 */

import path from 'path';
import fs   from 'fs';

const DEFAULT_SCREENSHOT_DIR = path.resolve(process.cwd(), '.screenshots');

let _screenshotDir = DEFAULT_SCREENSHOT_DIR;

// ── Directory management ──────────────────────────────────────────────────────

export function getScreenshotDir(): string {
  return _screenshotDir;
}

export function setScreenshotDir(dir: string): void {
  _screenshotDir = dir;
}

export function ensureScreenshotDir(): string {
  if (!fs.existsSync(_screenshotDir)) {
    fs.mkdirSync(_screenshotDir, { recursive: true });
  }
  return _screenshotDir;
}

export function ensureRunDir(runId: string): string {
  const dir = path.join(ensureScreenshotDir(), runId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ── Path builders ─────────────────────────────────────────────────────────────

/**
 * Builds a full file path for a screenshot.
 * sessionId is optional — used to make filenames unique across sessions.
 */
export function buildScreenshotPath(
  runId:      string,
  label:      string,
  sessionId?: string,
): string {
  const dir       = ensureRunDir(runId);
  const sanitized = label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const suffix    = sessionId ? `_${sessionId.slice(-8)}` : '';
  const ts        = Date.now();
  const filename  = `${sanitized}${suffix}_${ts}.png`;
  return path.join(dir, filename);
}

/**
 * Builds a path for a baseline screenshot (used by visual diff detector).
 */
export function buildBaselinePath(runId: string, label: string): string {
  const dir       = path.join(ensureScreenshotDir(), 'baselines', runId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sanitized = label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(dir, `${sanitized}_baseline.png`);
}

// ── Metadata ──────────────────────────────────────────────────────────────────

/**
 * Returns the file size of a screenshot in bytes; 0 if file doesn't exist.
 */
export function getScreenshotSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * Reads a screenshot file into a Buffer; returns null on any error.
 */
export function readScreenshotBuffer(filePath: string): Buffer | null {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Saves a screenshot as a visual baseline.
 * Signature: saveBaseline(sourcePath, destPath) → boolean
 * (matches usage in visual-diff-detector.ts)
 */
export function saveBaseline(sourcePath: string, destPath: string): boolean {
  try {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the baseline path if it exists, otherwise null.
 */
export function getBaselinePath(runId: string, label: string): string | null {
  const p = buildBaselinePath(runId, label);
  return fs.existsSync(p) ? p : null;
}

// ── Listing ───────────────────────────────────────────────────────────────────

export function listScreenshotsForRun(runId: string): string[] {
  const dir = path.join(_screenshotDir, runId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.png'))
    .map(f => path.join(dir, f));
}
