import { scanFolder, type ScanEntry } from './folder-scanner.ts';

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  children?: TreeNode[];
}

export interface FolderStructureOptions {
  sandboxRoot: string;
  path: string;
  maxDepth?: number;
  includeHidden?: boolean;
}

function buildTree(entries: ScanEntry[], basePath: string, depth: number): TreeNode[] {
  const direct = entries.filter(e => {
    const parent = e.relativePath.slice(0, e.relativePath.lastIndexOf('/'));
    return (parent || basePath) === basePath && e.depth === depth;
  });

  return direct.map(entry => {
    const node: TreeNode = {
      name: entry.name,
      path: entry.relativePath,
      isDirectory: entry.isDirectory,
      size: entry.size,
    };

    if (entry.isDirectory) {
      node.children = buildTree(entries, entry.relativePath, depth + 1);
    }

    return node;
  });
}

export async function getFolderStructure(opts: FolderStructureOptions): Promise<TreeNode[]> {
  const result = await scanFolder({
    sandboxRoot: opts.sandboxRoot,
    path: opts.path,
    maxDepth: opts.maxDepth,
    includeHidden: opts.includeHidden,
  });
  return buildTree(result.entries, opts.path, 1);
}

export function renderAsciiTree(nodes: TreeNode[], prefix = '', isLast = true): string {
  const lines: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLastNode = i === nodes.length - 1;
    const connector = isLastNode ? '└── ' : '├── ';
    const label = node.isDirectory ? `${node.name}/` : node.name;

    lines.push(`${prefix}${connector}${label}`);

    if (node.children && node.children.length > 0) {
      const childPrefix = prefix + (isLastNode ? '    ' : '│   ');
      lines.push(renderAsciiTree(node.children, childPrefix, isLastNode));
    }
  }

  return lines.join('\n');
}

export async function getAsciiTree(opts: FolderStructureOptions): Promise<string> {
  const nodes = await getFolderStructure(opts);
  return `${opts.path}/\n${renderAsciiTree(nodes)}`;
}
