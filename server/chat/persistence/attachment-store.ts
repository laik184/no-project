/**
 * attachment-store.ts — Delegates to attachmentRepository.
 * Kept for backward-compat. Import attachmentRepository directly for new code.
 */
import { attachmentRepository } from '../../repositories/chat/attachment.repository.ts';

export type { AttachmentRecord } from '../../repositories/chat/attachment.repository.ts';

export const attachmentStore = attachmentRepository;
