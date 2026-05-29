/**
 * upload-handler.ts — Handles multipart file upload to disk.
 * Owns: stream file to upload dir, return stored path.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_DIR } from '../constants/chat.constants.ts';

export interface UploadedFile {
  filename:    string;
  storedPath:  string;
  mimeType:    string;
  sizeBytes:   number;
}

/** Ensure the upload directory exists. */
function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Write a Buffer to the upload directory with a random name.
 * Returns the stored path (relative to cwd) and byte size.
 */
export async function storeUpload(
  originalName: string,
  mimeType:     string,
  data:         Buffer,
): Promise<UploadedFile> {
  ensureUploadDir();

  const ext      = path.extname(originalName).slice(0, 10).toLowerCase();
  const hash     = crypto.randomBytes(8).toString('hex');
  const basename = `${Date.now()}-${hash}${ext}`;
  const stored   = path.join(UPLOAD_DIR, basename);

  await fs.promises.writeFile(stored, data);

  return {
    filename:   originalName,
    storedPath: stored,
    mimeType,
    sizeBytes:  data.length,
  };
}

/**
 * Delete a stored upload by path (called on cleanup / attachment delete).
 * Silently ignores missing files.
 */
export async function deleteStoredUpload(storedPath: string): Promise<void> {
  try {
    await fs.promises.unlink(storedPath);
  } catch {
    /* file already gone — ignore */
  }
}

/**
 * Read a stored file into a Buffer.
 */
export async function readStoredUpload(storedPath: string): Promise<Buffer> {
  return fs.promises.readFile(storedPath);
}
