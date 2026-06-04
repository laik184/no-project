/**
 * server/repositories/chat/attachment.repository.ts
 *
 * Repository pattern over chat_uploads table.
 * Single import point for attachment persistence — chat/persistence/ uses this.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../infrastructure/index.ts';
import { chatUploads } from '../../../shared/schema.ts';

export interface AttachmentRecord {
  id:         number;
  projectId:  number;
  runId?:     string;
  filename:   string;
  mimeType:   string;
  storedPath: string;
  sizeBytes:  number;
  createdAt:  Date;
}

function rowToRecord(row: typeof chatUploads.$inferSelect): AttachmentRecord {
  return {
    id:         row.id,
    projectId:  row.projectId!,
    runId:      row.runId ?? undefined,
    filename:   row.filename,
    mimeType:   row.mimeType,
    storedPath: row.storedPath,
    sizeBytes:  row.sizeBytes,
    createdAt:  row.createdAt!,
  };
}

export const attachmentRepository = {
  async insert(data: Omit<AttachmentRecord, 'id' | 'createdAt'>): Promise<AttachmentRecord> {
    const [row] = await db.insert(chatUploads).values({
      projectId:  data.projectId,
      runId:      data.runId,
      filename:   data.filename,
      mimeType:   data.mimeType,
      storedPath: data.storedPath,
      sizeBytes:  data.sizeBytes,
    }).returning();
    return rowToRecord(row);
  },

  async listByProject(projectId: number): Promise<AttachmentRecord[]> {
    const rows = await db.select().from(chatUploads).where(eq(chatUploads.projectId, projectId));
    return rows.map(rowToRecord);
  },

  async listByRun(runId: string): Promise<AttachmentRecord[]> {
    const rows = await db.select().from(chatUploads).where(eq(chatUploads.runId, runId));
    return rows.map(rowToRecord);
  },

  async findById(id: number): Promise<AttachmentRecord | null> {
    const rows = await db.select().from(chatUploads).where(eq(chatUploads.id, id)).limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  },

  async countByRun(runId: string): Promise<number> {
    const rows = await db.select({ id: chatUploads.id }).from(chatUploads).where(eq(chatUploads.runId, runId));
    return rows.length;
  },
};
