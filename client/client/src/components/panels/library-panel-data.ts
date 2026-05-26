export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  language?: string;
}

export interface OpenFile {
  id: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface ContextMenu {
  x: number;
  y: number;
  nodeId: string | null;
}

export interface SearchResult {
  fileId: string;
  fileName: string;
  lineNumber: number;
  lineText: string;
  matchIndex: number;
}

export const DEFAULT_TREE: FileNode[] = [
  {
    id: "src",
    name: "src",
    type: "folder",
    children: [
      {
        id: "index-html",
        name: "index.html",
        type: "file",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="styles/main.css" />
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        id: "app-js",
        name: "app.js",
        type: "file",
        language: "javascript",
        content: `// Main application entry point
const app = document.getElementById('app');

function render() {
  app.innerHTML = \`
    <h1>Hello, World!</h1>
    <p>Welcome to my app.</p>
  \`;
}

render();`,
      },
      {
        id: "utils-js",
        name: "utils.js",
        type: "file",
        language: "javascript",
        content: `// Utility functions

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US').format(date);
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}`,
      },
      {
        id: "styles",
        name: "styles",
        type: "folder",
        children: [
          {
            id: "main-css",
            name: "main.css",
            type: "file",
            language: "css",
            content: `/* Main styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}

#app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}`,
          },
        ],
      },
    ],
  },
  {
    id: "readme-md",
    name: "README.md",
    type: "file",
    language: "markdown",
    content: `# My Project

A modern web application built with AI assistance.

## Getting Started

1. Clone the repository
2. Install dependencies
3. Run the development server

## Features

- Fast and responsive
- AI-powered development
- Modern tech stack`,
  },
  {
    id: "package-json",
    name: "package.json",
    type: "file",
    language: "json",
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "description": "A modern web application",
  "main": "src/app.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {},
  "devDependencies": {
    "vite": "^5.0.0"
  }
}`,
  },
];

export function getLanguageIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext ?? "txt";
}

export function detectLanguage(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: "javascript", ts: "typescript", jsx: "javascript", tsx: "typescript",
    html: "html", css: "css", json: "json", md: "markdown",
    py: "python", sh: "shell", yml: "yaml", yaml: "yaml",
  };
  return map[ext || ""] || "plaintext";
}

export function findNode(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function removeNode(nodes: FileNode[], id: string): FileNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: n.children ? removeNode(n.children, id) : undefined }));
}

export function insertNode(nodes: FileNode[], parentId: string, newNode: FileNode): FileNode[] {
  return nodes.map((n) => {
    if (n.id === parentId && n.type === "folder") {
      return { ...n, children: [...(n.children || []), newNode] };
    }
    if (n.children) return { ...n, children: insertNode(n.children, parentId, newNode) };
    return n;
  });
}

export function updateNodeContent(nodes: FileNode[], id: string, content: string): FileNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, content };
    if (n.children) return { ...n, children: updateNodeContent(n.children, id, content) };
    return n;
  });
}

export function renameNode(nodes: FileNode[], id: string, newName: string): FileNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, name: newName, language: n.type === "file" ? detectLanguage(newName) : undefined };
    if (n.children) return { ...n, children: renameNode(n.children, id, newName) };
    return n;
  });
}

export function getNodePath(nodes: FileNode[], id: string, current = ""): string | null {
  for (const node of nodes) {
    const path = current ? `${current}/${node.name}` : node.name;
    if (node.id === id) return path;
    if (node.children) {
      const found = getNodePath(node.children, id, path);
      if (found) return found;
    }
  }
  return null;
}

export function searchAllFiles(nodes: FileNode[], query: string): SearchResult[] {
  if (!query.trim()) return [];
  const results: SearchResult[] = [];
  const lower = query.toLowerCase();
  const traverse = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === "file" && node.content) {
        const lines = node.content.split("\n");
        lines.forEach((line, idx) => {
          const matchIndex = line.toLowerCase().indexOf(lower);
          if (matchIndex !== -1) {
            results.push({ fileId: node.id, fileName: node.name, lineNumber: idx + 1, lineText: line.trim(), matchIndex });
          }
        });
      }
      if (node.children) traverse(node.children);
    }
  };
  traverse(nodes);
  return results;
}
