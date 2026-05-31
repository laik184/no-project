import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Pencil, Search, FilePlus, FolderPlus, ChevronsUpDown,
  Terminal, Copy, Link2, Download, Trash2,
} from "lucide-react";
import { FileNode } from "./types";

interface TreeNodeMenuProps {
  node:        FileNode;
  path:        string;
  x:           number;
  y:           number;
  onClose:     () => void;
  onRename:    () => void;
  onDelete:    () => void;
  onAddFile?:  () => void;
  onAddFolder?:() => void;
  onCollapse?: () => void;
  onDownload?: () => void;
}

type ItemDef = {
  Icon:          React.ElementType;
  label:         string;
  onClick:       () => void;
  danger?:       boolean;
  dividerBefore?: boolean;
  disabled?:     boolean;
};

function Divider() {
  return <div style={{ height: 1, background: "#2a2a2a", margin: "2px 0" }} />;
}

export function TreeNodeMenu({
  node, path, x, y, onClose, onRename, onDelete,
  onAddFile, onAddFolder, onCollapse, onDownload,
}: TreeNodeMenuProps) {
  const ref   = useRef<HTMLDivElement>(null);
  const isDir = node.type === "folder";

  // Close on outside click or Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // Slight delay so the opener click doesn't immediately close
    const id = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown",   onKey);
    }, 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
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

  // ── All 10 items — folder-only ones hidden for files ──────────────────────
  const allItems: (ItemDef | "divider")[] = [
    { Icon: Pencil,         label: "Rename",               onClick: () => { onRename(); onClose(); } },
    "divider",
    { Icon: Search,         label: "Search this directory", onClick: searchDir,  disabled: false },
    { Icon: FilePlus,       label: "Add file",              onClick: () => { onAddFile?.();  onClose(); }, disabled: !isDir },
    { Icon: FolderPlus,     label: "Add folder",            onClick: () => { onAddFolder?.(); onClose(); }, disabled: !isDir },
    "divider",
    { Icon: ChevronsUpDown, label: "Collapse child folders",onClick: () => { onCollapse?.(); onClose(); }, disabled: !isDir },
    { Icon: Terminal,       label: "Open shell here",       onClick: openShell },
    "divider",
    { Icon: Copy,           label: "Copy file path",        onClick: copyPath },
    { Icon: Link2,          label: "Copy link",             onClick: copyLink },
    "divider",
    { Icon: Download,       label: isDir ? "Download folder" : "Download file", onClick: () => { onDownload?.(); onClose(); } },
    "divider",
    { Icon: Trash2,         label: "Delete",                onClick: () => { onDelete(); onClose(); }, danger: true },
  ];

  // Filter out items disabled for files (Add file, Add folder, Collapse)
  const visibleItems = allItems.filter((item, i, arr) => {
    if (item === "divider") {
      // Drop divider if next visible item is also divider or it's at the end
      const nextItem = arr.slice(i + 1).find(x => x !== "divider");
      return !!nextItem;
    }
    if (!isDir && (item.label === "Add file" || item.label === "Add folder" || item.label === "Collapse child folders")) {
      return false;
    }
    return true;
  });

  // Position: open upward if near bottom of viewport
  const ITEM_H  = 28;
  const DIV_H   = 5;
  const PAD     = 4;
  const itemCount = visibleItems.filter(i => i !== "divider").length;
  const divCount  = visibleItems.filter(i => i === "divider").length;
  const menuH   = itemCount * ITEM_H + divCount * DIV_H + PAD * 2;
  const menuW   = 208;
  const vw      = window.innerWidth;
  const vh      = window.innerHeight;

  const left = Math.min(x, vw - menuW - 8);
  const top  = y + menuH > vh - 8 ? Math.max(8, y - menuH) : y;

  const menu = (
    <div
      ref={ref}
      style={{
        position: "fixed", top, left, zIndex: 99999,
        background: "#1c1c1c", border: "1px solid #2e2e2e",
        borderRadius: 8, padding: `${PAD}px 0`,
        boxShadow: "0 16px 40px rgba(0,0,0,.8), 0 4px 12px rgba(0,0,0,.5)",
        minWidth: menuW, maxHeight: Math.min(menuH + 8, vh - 32),
        overflowY: "auto",
        fontFamily: "'Inter', system-ui, sans-serif",
        userSelect: "none",
      }}
      data-testid="tree-node-menu"
    >
      {visibleItems.map((item, i) => {
        if (item === "divider") {
          return <Divider key={`div-${i}`} />;
        }
        const { Icon, label, onClick, danger } = item;
        return (
          <div
            key={label}
            onClick={onClick}
            data-testid={`menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "5px 12px", cursor: "pointer", fontSize: 13,
              height: ITEM_H,
              color: danger ? "#f87171" : "#b4b4b4",
              transition: "background .08s, color .08s",
              whiteSpace: "nowrap",
              boxSizing: "border-box",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = danger ? "rgba(239,68,68,.14)" : "#272727";
              el.style.color      = danger ? "#ef4444"             : "#f0f0f0";
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
        );
      })}
    </div>
  );

  return createPortal(menu, document.body);
}
