export type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  lang?: string;
};

export type RawTreeNode = {
  name: string;
  type: "file" | "folder" | "directory";
  children?: RawTreeNode[];
  optimistic?: boolean;
};

export type ContextMenuState = {
  x: number;
  y: number;
  path: string;
  isDir: boolean;
} | null;
