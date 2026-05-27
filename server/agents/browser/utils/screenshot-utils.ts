/**
 * screenshot-utils.ts
 * Screenshot file paths, naming, and metadata helpers.
 */

import fs   from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), '.data', 'browser-screenshots');

export function ensureScreenshotDir(): void {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

export function buildScreenshotPath(runId: string, label: string): string {
  ensureScreenshotDir();
  const safe      = label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const ts        = Date.now();
  const filename  = `${runId}_${safe}_${ts}.png`;
  return path.join(SCREENSHOT_DIR, filename);
}

export function screenshotExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function getScreenshotSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

export function readScreenshotBuffer(filePath: string): Buffer | null {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

export function buildBaselinePath(runId: string, label: string): string {
  ensureScreenshotDir();
  const safe = label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(SCREENSHOT_DIR, `baseline_${runId}_${safe}.png`);
}

export function saveBaseline(sourcePath: string, baselinePath: string): boolean {
  try {
    fs.copyFileSync(sourcePath, baselinePath);
    return true;
  } catch {
    return false;
  }
}

export function getScreenshotDir(): string {
  return SCREENSHOT_DIR;
}
