import { FilePlus, FolderPlus, FolderUp, Download, Eye, EyeOff, ChevronsUpDown, FolderOpen } from "lucide-react";
import { FileNode } from "./types";
import { guessLang } from "./file-icon";
import { uid } from "./tree-helpers";

export function MenuDivider() {
  return <div style={{ height: 1, background: "#272727", margin: "3px 0" }} />;
}

export function MenuItem({ Icon, label, onClick, active, testId }: {
  Icon: React.ElementType; label: string; onClick: () => void; active?: boolean; testId?: string;
}) {
  return (
    <button
      role="menuitem" onClick={onClick} data-testid={testId}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "6px 14px",
        background: "transparent", border: "none", cursor: "pointer",
        color: active ? "#60a5fa" : "#aaaaaa",
        fontSize: 13, fontFamily: "inherit", textAlign: "left",
        transition: "background .1s, color .1s",
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#272727"; el.style.color = active ? "#93c5fd" : "#e0e0e0"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = active ? "#60a5fa" : "#aaaaaa"; }}
    >
      <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
      {label}
    </button>
  );
}

interface ExplorerMenuProps {
  showHidden: boolean;
  onNewFile: () => void; onNewFolder: () => void;
  onUploadFolder: () => void; onDownloadZip: () => void;
  onToggleHidden: () => void; onCollapseAll: () => void;
  onCloseFiles: () => void;
}

export function ExplorerMenu(p: ExplorerMenuProps) {
  return (
    <div role="menu" aria-label="Explorer actions" style={{
      position: "absolute", top: "calc(100% + 5px)", right: 0, zIndex: 200,
      background: "#1a1a1a", border: "1px solid #2e2e2e",
      borderRadius: 8, padding: "4px 0",
      boxShadow: "0 12px 32px rgba(0,0,0,.6)", minWidth: 160,
    }}>
      <MenuItem Icon={FilePlus}   label="New file"    testId="menu-new-file"    onClick={p.onNewFile} />
      <MenuItem Icon={FolderPlus} label="New folder"  testId="menu-new-folder"  onClick={p.onNewFolder} />
      <MenuDivider />
      <MenuItem Icon={FolderUp}   label="Upload folder"  testId="menu-upload-folder" onClick={p.onUploadFolder} />
      <MenuItem Icon={Download}   label="Download as zip" testId="menu-download-zip"  onClick={p.onDownloadZip} />
      <MenuDivider />
      <MenuItem
        Icon={p.showHidden ? EyeOff : Eye}
        label={p.showHidden ? "Hide hidden files" : "Show hidden files"}
        active={p.showHidden} testId="menu-toggle-hidden" onClick={p.onToggleHidden}
      />
      <MenuItem Icon={ChevronsUpDown} label="Collapse all" testId="menu-collapse-all" onClick={p.onCollapseAll} />
      <MenuDivider />
      <MenuItem Icon={FolderOpen} label="Close files" testId="menu-close-files" onClick={p.onCloseFiles} />
    </div>
  );
}

export function buildTreeFromFiles(items: { path: string; content: string }[]): FileNode[] {
  const root: FileNode[] = [];
  for (const { path, content } of items) {
    const parts = path.split("/").filter(Boolean);
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let folder = cursor.find(n => n.type === "folder" && n.name === part);
      if (!folder) {
        folder = { id: uid(), name: part, type: "folder", children: [] };
        cursor.push(folder);
      }
      cursor = folder.children!;
    }
    const fileName = parts[parts.length - 1];
    if (fileName) cursor.push({ id: uid(), name: fileName, type: "file", lang: guessLang(fileName), content });
  }
  return root;
}

export function flattenVisibleIds(nodes: FileNode[], expandedIds: Set<string>): string[] {
  const result: string[] = [];
  const walk = (list: FileNode[]) => {
    for (const node of list) {
      result.push(node.id);
      if (node.type === "folder" && expandedIds.has(node.id) && node.children) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}
