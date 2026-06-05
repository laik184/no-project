import { FilePlus, FolderPlus } from "lucide-react";
import { RawTreeNode } from "./types";
import { InlineInput } from "./InlineInput";

export const INDENT = 14;

export function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000)      return "just now";
  if (d < 3_600_000)   return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000)  return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 172_800_000) return "yesterday";
  if (d < 604_800_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function countDescendantFiles(nodes: RawTreeNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === "file") n++;
    else if (node.children) n += countDescendantFiles(node.children);
  }
  return n;
}

export function collectSearchExpanded(
  nodes: RawTreeNode[], basePath: string, sq: string, result: Set<string>,
): boolean {
  let anyMatch = false;
  for (const n of nodes) {
    const full = basePath ? `${basePath}/${n.name}` : n.name;
    if (n.type === "file") {
      if (n.name.toLowerCase().includes(sq)) anyMatch = true;
    } else if (n.children) {
      const childMatch = collectSearchExpanded(n.children, full, sq, result);
      if (childMatch) { result.add(full); anyMatch = true; }
    }
  }
  return anyMatch;
}

export function InlineCreateRow({
  type, onConfirm, onCancel,
}: { type: "file" | "folder"; onConfirm: (name: string) => void; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 6px 2px 8px", height: 22, borderBottom: "1px solid #222", background: "#1e1e1e" }}>
      {type === "file"
        ? <FilePlus style={{ width: 11, height: 11, color: "#60a5fa", flexShrink: 0 }} />
        : <FolderPlus style={{ width: 11, height: 11, color: "#e8a427", flexShrink: 0 }} />}
      <InlineInput
        initialValue={type === "file" ? "untitled.tsx" : "new-folder"}
        onConfirm={onConfirm} onCancel={onCancel}
      />
    </div>
  );
}
