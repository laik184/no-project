/**
 * server/file-explorer/utils/zip.util.ts
 * Async zip creation helper using archiver.
 * Only used by download.service — isolated here so no other file needs archiver.
 */

/** Creates an in-memory zip of the given directory. Returns a Buffer. */
export async function zipDirectory(absDir: string): Promise<Buffer> {
  const { default: archiver } = await import('archiver');
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('data',  (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', reject);
    archive.on('end',   () => resolve(Buffer.concat(chunks)));
    archive.directory(absDir, false);
    archive.finalize();
  });
}
