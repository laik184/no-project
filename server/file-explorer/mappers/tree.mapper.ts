/**
 * server/file-explorer/mappers/tree.mapper.ts
 * Converts raw filesystem entries into the RawTreeNode contract the frontend expects.
 * type: 'file' | 'folder' — NOT isDirectory boolean (legacy FileItem shape).
 */

export { buildTreeFromDir } from '../../shared/filesystem/tree-builder.ts';
