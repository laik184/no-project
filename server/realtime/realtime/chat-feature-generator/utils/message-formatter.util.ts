import type { ChatMessage, ChatRoom, ChatUser } from '../types.js';

export function formatMessageForTransport(message: ChatMessage): string {
  return JSON.stringify({
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    content: message.content,
    sentAt: message.sentAt,
    readBy: message.readBy,
  });
}

export function formatRoomSummary(room: ChatRoom, users: readonly ChatUser[]): string {
  return `${room.name} (${room.id}) members=${users.length}`;
}
