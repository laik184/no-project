import { fileReader } from './file-reader.ts';
import { fileWriter } from './file-writer.ts';
import { permissionManager } from '../sandbox/permission-manager.ts';

export const fileEditor = {
  /** Append text to the end of a file. */
  async append(projectId: string, relativePath: string, text: string): Promise<void> {
    permissionManager.assertWrite(relativePath);
    const existing = await fileReader.read(projectId, relativePath).catch(() => '');
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    await fileWriter.write(projectId, relativePath, `${existing}${separator}${text}`);
  },

  /** Replace every occurrence of a search string with a replacement. */
  async replaceAll(
    projectId: string,
    relativePath: string,
    search: string,
    replacement: string,
  ): Promise<number> {
    permissionManager.assertWrite(relativePath);
    const content  = await fileReader.read(projectId, relativePath);
    let   count    = 0;
    const modified = content.replace(new RegExp(escapeRegex(search), 'g'), () => {
      count++;
      return replacement;
    });
    if (count > 0) await fileWriter.write(projectId, relativePath, modified);
    return count;
  },

  /** Replace a single specific line (1-indexed). */
  async replaceLine(
    projectId: string,
    relativePath: string,
    lineNumber: number,
    newContent: string,
  ): Promise<void> {
    permissionManager.assertWrite(relativePath);
    const lines = await fileReader.readLines(projectId, relativePath);
    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Line ${lineNumber} out of range (file has ${lines.length} lines)`);
    }
    lines[lineNumber - 1] = newContent;
    await fileWriter.write(projectId, relativePath, lines.join('\n'));
  },

  /** Insert text at a specific line (1-indexed), shifting subsequent lines down. */
  async insertAt(
    projectId: string,
    relativePath: string,
    lineNumber: number,
    text: string,
  ): Promise<void> {
    permissionManager.assertWrite(relativePath);
    const lines = await fileReader.readLines(projectId, relativePath);
    lines.splice(lineNumber - 1, 0, text);
    await fileWriter.write(projectId, relativePath, lines.join('\n'));
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
