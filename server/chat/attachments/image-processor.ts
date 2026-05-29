/**
 * image-processor.ts — Image attachment processing.
 * Extracts metadata from uploaded images.
 * Note: heavy processing (resize/compress) is out of scope for chat module.
 */
import { ACCEPTED_IMAGE_MIME_TYPES } from '../constants/chat.constants.ts';

export interface ImageMetadata {
  mimeType:  string;
  sizeBytes: number;
  isImage:   boolean;
}

/**
 * Extract basic metadata from image buffer.
 * Returns minimal metadata — dimensions require a native lib (not added here).
 */
export function extractImageMetadata(
  data:     Buffer,
  mimeType: string,
): ImageMetadata {
  const accepted = ACCEPTED_IMAGE_MIME_TYPES as readonly string[];
  return {
    mimeType,
    sizeBytes: data.length,
    isImage:   accepted.includes(mimeType),
  };
}

/**
 * Detect image MIME type from magic bytes (first 4 bytes).
 */
export function detectImageMimeFromBytes(data: Buffer): string | null {
  if (data.length < 4) return null;

  // PNG: 89 50 4E 47
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'image/jpeg';
  }
  // GIF: 47 49 46
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return 'image/gif';
  }
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    data[0] === 0x52 && data[1] === 0x49 &&
    data[2] === 0x46 && data[3] === 0x46 &&
    data.length >= 12 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}
