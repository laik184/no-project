import { randomUUID } from 'node:crypto';

export const generateSocketId = (): string => randomUUID();
