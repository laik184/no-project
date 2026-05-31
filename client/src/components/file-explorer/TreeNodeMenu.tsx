import { useEffect, useRef } from "react";
import {
  Pencil, Search, FilePlus, FolderPlus, ChevronsUpDown,
  Terminal, Copy, Link2, Download, Trash2,
} from "lucide-react";
import { FileNode } from "./types";

interface TreeNodeMenuProps {
  node:       FileNode;
  path:       string;
  x:          number;
  y:          number;
  onClose:    () => void;
  onRename:   () => void;
  onDelete:   () => void;
  onAddFile?: () => void;
  onAddFolder?: () => void;
  onCollapse?: () => void;
  onDownload?: () => void;
}

type ItemDef = {
  Icon:    React.ElementType;
  label:   string;
  onClick: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
};

export function TreeNodeMenu({
  node, path, x, y, onClose, onRename, onDelete,
  onAddFile, onAddFolder, onCollapse, onDownload,
}: TreeNodeMenuProps) {
  const ref  = useRef<HTMLDivElement>(null);
  const isDir = node.type === "folder";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown",   onKey);
    };
  }, [onClose]);

  const copyPath = () => {
    try { navigator.clipboard.writeText(path || node.name); } catch {}
    onClose();
  };
  const copyLink = () => {
    try { navigator.clipboard.writeText(window.location.origin + "/" + (path || node.name)); } catch {}
    onClose();
  };
  const openShell = () => {
    window.dispatchEvent(new CustomEvent("shell:open", { detail: { path } }));
    onClose();
  };
  const searchDir = () => {
    window.dispatchEvent(new CustomEvent("explorer:search-dir", { detail: { path, id: node.id } }));
    onClose();
  };

  const fileItems: ItemDef[] = [
    { Icon: Pencil, label: "Rename",        onClick: () => { onRename(); onClose(); } },
    { Icon: Copy,   label: "Copy file path", onClick: copyPath, dividerBefore: true },
    { Icon: Link2,  label: "Copy link",      onClick: copyLink },
    { Icon: Trash2, label: "Delete",         onClick: () => { onDelete(); onClose(); }, danger: true, dividerBefore: true },
  ];

  const dirItems: ItemDef[] = [
    { Icon: Pencil,        label: "Rename",               onClick: () => { onRename(); onClose(); } },
    { Icon: Search,        label: "Search this directory", onClick: searchDir, dividerBefore: true },
    { Icon: FilePlus,      label: "Add file",              onClick: () => { onAddFile?.(); onClose(); } },
    { Icon: FolderPlus,    label: "Add folder",            onClick: () => { onAddFolder?.(); onClose(); } },
    { Icon: ChevronsUpDown,label: "Collapse child folders",onClick: () => { onCollapse?.(); onClose(); }, dividerBefore: true },
    { Icon: Terminal,      label: "Open shell here",       onClick: openShell },
    { Icon: Copy,          label: "Copy file path",        onClick: copyPath,  dividerBefore: true },
    { Icon: Link2,         label: "Copy link",             onClick: copyLink },
    { Icon: Download,      label: "Download folder",       onClick: () => { onDownload?.(); onClose(); }, dividerBefore: true },
    { Icon: Trash2,        label: "Delete",                onClick: () => { onDelete(); onClose(); }, danger: true, dividerBefore: true },
  ];

  const items = isDir ? dirItems : fileItems;

  // Clamp to viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  const menuW = 210, menuH = items.length * 30 + 16;
  const left  = Math.min(x, vw - menuW - 8);
  const top   = Math.min(y, vh - menuH - 8);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 8000 }} onClick={onClose} />
      <div
        ref={ref}
        style={{
          position: "fixed", top, left, zIndex: 8001,
          background: "#1a1a1a", border: "1px solid #2a2a2a",
          borderRadius: 8, padding: "4px 0",
          boxShadow: "0 10px 30px rgba(0,0,0,.7), 0 2px 8px rgba(0,0,0,.4)",
          minWidth: menuW,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
        data-testid="tree-node-menu"
      >
        {items.map(({ Icon, label, onClick, danger, dividerBefore }) => (
          <div key={label}>
            {dividerBefore && (
              <div style={{ height: 1, background: "#242424", margin: "3px 8px" }} />
            )}
            <div
              onClick={onClick}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "5px 12px", cursor: "pointer", fontSize: 12,
                color: danger ? "#f87171" : "#b4b4b4",
                transition: "background .08s, color .08s",
              }}
              data-testid={`menu-item-${label.toLowerCase().replace(/\s+/g, "-")}`}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = danger ? "rgba(239,68,68,.12)" : "#252525";
                el.style.color      = danger ? "#ef4444" : "#f0f0f0";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
                el.style.color      = danger ? "#f87171" : "#b4b4b4";
              }}
            >
              <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
              {label}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
