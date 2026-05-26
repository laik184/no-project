import { FileNode, RawTreeNode } from "./types";
import { guessLang } from "./file-icon";

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function flattenFiles(
  nodes: FileNode[],
  path = ""
): { node: FileNode; path: string }[] {
  const result: { node: FileNode; path: string }[] = [];
  for (const n of nodes) {
    const fullPath = path ? `${path}/${n.name}` : n.name;
    if (n.type === "file") result.push({ node: n, path: fullPath });
    if (n.type === "folder" && n.children)
      result.push(...flattenFiles(n.children, fullPath));
  }
  return result;
}

export function deleteNodeById(nodes: FileNode[], id: string): FileNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({
      ...n,
      children: n.children ? deleteNodeById(n.children, id) : undefined,
    }));
}

export function renameNodeById(
  nodes: FileNode[],
  id: string,
  newName: string
): FileNode[] {
  return nodes.map((n) => {
    if (n.id === id)
      return { ...n, name: newName, lang: n.type === "file" ? guessLang(newName) : n.lang };
    return { ...n, children: n.children ? renameNodeById(n.children, id, newName) : undefined };
  });
}

export function addNodeToRoot(nodes: FileNode[], node: FileNode): FileNode[] {
  return [node, ...nodes];
}

export function optimisticInsertFile(tree: RawTreeNode[], filePath: string): RawTreeNode[] {
  const parts = filePath.split("/").filter(Boolean);
  const fileName = parts.pop();
  const newTree: RawTreeNode[] = JSON.parse(JSON.stringify(tree || []));
  let cursor: RawTreeNode[] = newTree;
  for (const part of parts) {
    let folder = cursor.find((n) => n.type === "folder" && n.name === part);
    if (!folder) {
      folder = { type: "folder", name: part, children: [] };
      cursor.push(folder);
    }
    cursor = folder.children!;
  }
  if (fileName && !cursor.find((n) => n.type === "file" && n.name === fileName))
    cursor.push({ type: "file", name: fileName, optimistic: true });
  return newTree;
}

export function removeOptimisticFile(tree: RawTreeNode[], filePath: string): RawTreeNode[] {
  const parts = filePath.split("/").filter(Boolean);
  const fileName = parts.pop();
  const newTree: RawTreeNode[] = JSON.parse(JSON.stringify(tree || []));
  let cursor: RawTreeNode[] = newTree;
  for (const part of parts) {
    const folder = cursor.find((n) => n.type === "folder" && n.name === part);
    if (!folder) return newTree;
    cursor = folder.children!;
  }
  if (fileName) {
    const idx = cursor.findIndex((n) => n.type === "file" && n.name === fileName && n.optimistic);
    if (idx !== -1) cursor.splice(idx, 1);
  }
  return newTree;
}

export function makeInitialTree(): FileNode[] {
  return [
    {
      id: uid(), name: "client", type: "folder",
      children: [
        {
          id: uid(), name: "src", type: "folder",
          children: [
            {
              id: uid(), name: "components", type: "folder",
              children: [
                { id: uid(), name: "Button.tsx", type: "file", lang: "typescript", content: `import { cn } from "@/lib/utils";\n\ninterface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {\n  variant?: "default" | "outline" | "ghost";\n}\n\nexport function Button({ className, variant = "default", children, ...props }: ButtonProps) {\n  return <button className={cn("px-4 py-2 rounded-lg font-medium", className)} {...props}>{children}</button>;\n}` },
                { id: uid(), name: "Card.tsx",   type: "file", lang: "typescript", content: `import { cn } from "@/lib/utils";\n\nexport function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {\n  return <div className={cn("rounded-xl border bg-card p-6", className)} {...props}>{children}</div>;\n}` },
              ],
            },
            {
              id: uid(), name: "pages", type: "folder",
              children: [
                { id: uid(), name: "home.tsx", type: "file", lang: "typescript", content: `export default function Home() {\n  return <div className="min-h-screen flex items-center justify-center"><h1 className="text-4xl font-bold">Welcome</h1></div>;\n}` },
              ],
            },
            { id: uid(), name: "main.tsx",  type: "file", lang: "typescript", content: `import ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\nReactDOM.createRoot(document.getElementById("root")!).render(<App />);` },
            { id: uid(), name: "index.css", type: "file", lang: "css",         content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n` },
            { id: uid(), name: "App.tsx",   type: "file", lang: "typescript",  content: `import { Switch, Route } from "wouter";\nimport Home from "@/pages/home";\nexport default function App() {\n  return <Switch><Route path="/" component={Home} /></Switch>;\n}` },
          ],
        },
        { id: uid(), name: "index.html", type: "file", lang: "html", content: `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8"/><title>Nura X</title></head>\n  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>\n</html>` },
      ],
    },
    { id: uid(), name: "shared", type: "folder", children: [
      { id: uid(), name: "schema.ts", type: "file", lang: "typescript", content: `export type User = { id: number; name: string; email: string; };` },
    ]},
    { id: uid(), name: "package.json",   type: "file", lang: "json",       content: `{\n  "name": "nura-x-app",\n  "version": "1.0.0"\n}` },
    { id: uid(), name: "tsconfig.json",  type: "file", lang: "json",       content: `{\n  "compilerOptions": { "strict": true, "jsx": "react-jsx" }\n}` },
    { id: uid(), name: "vite.config.ts", type: "file", lang: "typescript", content: `import { defineConfig } from "vite";\nexport default defineConfig({ server: { host: "0.0.0.0", port: 5000 } });` },
    { id: uid(), name: ".env",           type: "file", lang: "plaintext",  content: `DATABASE_URL=postgresql://localhost:5432/myapp\nNODE_ENV=development` },
  ];
}
