import { isImage } from './attachment-validator.ts';

export interface ImageInfo {
  mimeType:  string;
  sizeBytes: number;
  isImage:   boolean;
}

export function getImageInfo(mimeType: string, buffer: Buffer): ImageInfo {
  return {
    mimeType,
    sizeBytes: buffer.length,
    isImage:   isImage(mimeType),
  };
}

export function bufferToBase64(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
