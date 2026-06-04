/**
 * server/repositories/chat/message.repository.ts
 *
 * Repository pattern over chat_messages table.
 */
import { desc, eq } from 'drizzle-orm';
import { db } from '../../infrastructure';
import { chatMessages } from '../../../shared/schema.ts';
import type {
  ChatMessageRecord,
  AssistantMessagePayload,
  UserMessagePayload,
  SystemMessagePayload,
} from '../../chat/types/message.types.ts';

function rowToRecord(row: typeof chatMessages.$inferSelect): ChatMessageRecord {
  return {
    id:         row.id,
    projectId:  row.projectId!,
    runId:      row.runId ?? undefined,
    role:       row.role as ChatMessageRecord['role'],
    content:    row.content,
    tokensUsed: row.tokensUsed ?? 0,
    toolCalls:  row.toolCalls as ChatMessageRecord['toolCalls'],
    feedback:   row.feedback as ChatMessageRecord['feedback'],
    createdAt:  row.createdAt!,
  };
}

export const messageRepository = {
  async insertUser(payload: UserMessagePayload): Promise<ChatMessageRecord> {
    const [row] = await db.insert(chatMessages).values({
      projectId: payload.projectId,
      runId:     payload.runId,
      role:      'user',
      content:   payload.content,
    }).returning();
    return rowToRecord(row);
  },

  async insertAssistant(payload: AssistantMessagePayload): Promise<ChatMessageRecord> {
    const [row] = await db.insert(chatMessages).values({
      projectId:  payload.projectId,
      runId:      payload.runId,
      role:       'assistant',
      content:    payload.content,
      toolCalls:  payload.toolCalls as object,
      tokensUsed: payload.tokensUsed ?? 0,
    }).returning();
    return rowToRecord(row);
  },

  async insertSystem(payload: SystemMessagePayload): Promise<ChatMessageRecord> {
    const [row] = await db.insert(chatMessages).values({
      projectId: payload.projectId,
      runId:     payload.runId,
      role:      'system',
      content:   payload.content,
    }).returning();
    return rowToRecord(row);
  },

  async listByProject(projectId: number, limit = 50): Promise<ChatMessageRecord[]> {
    const rows = await db
      .select().from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return rows.map(rowToRecord).reverse();
  },

  async listByRun(runId: string): Promise<ChatMessageRecord[]> {
    const rows = await db
      .select().from(chatMessages)
      .where(eq(chatMessages.runId, runId))
      .orderBy(chatMessages.createdAt);
    return rows.map(rowToRecord);
  },

  async setFeedback(messageId: number, feedback: 'up' | 'down'): Promise<void> {
    await db.update(chatMessages).set({ feedback }).where(eq(chatMessages.id, messageId));
  },

  async findById(messageId: number): Promise<ChatMessageRecord | null> {
    const rows = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  },
};
