import type { UploadedFile } from '../file-explorer-core/contracts/index.ts';

export function toUploadedFile(
  original:  Express.Multer.File,
  savedPath: string,
): UploadedFile {
  return {
    originalName: original.originalname,
    savedPath,
    size:         original.size,
  };
}
