import fs from 'fs';
import path from 'path';

export interface ProcessedFile {
  filename:  string;
  mimeType:  string;
  buffer:    Buffer;
  sizeBytes: number;
}

export function readAttachmentFile(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return fs.readFileSync(filePath);
}

export function deleteAttachmentFile(filePath: string): void {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
}

export function getSafeFilename(original: string): string {
  return path.basename(original).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}
