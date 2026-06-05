import { useEffect, useRef } from "react";
import {
  Pencil, Search, FilePlus, FolderPlus, ChevronsDownUp,
  Terminal, Copy, Link2, Download, Trash2, MoreHorizontal,
} from "lucide-react";

export type MenuAction =
  | "rename" | "search-dir" | "new-file" | "new-folder"
  | "collapse" | "open-shell" | "copy-path" | "copy-link"
  | "download" | "delete";

interface MenuEntry {
  icon:    React.ElementType;
  label:   string;
  action:  MenuAction;
  danger?: boolean;
}
type MenuRow = MenuEntry | "divider";

export const DIR_MENU: MenuRow[] = [
  { icon: Pencil,        label: "Rename",               action: "rename"     },
  { icon: Search,        label: "Search this directory", action: "search-dir" },
  { icon: FilePlus,      label: "Add file",              action: "new-file"   },
  { icon: FolderPlus,    label: "Add folder",            action: "new-folder" },
  { icon: ChevronsDownUp,label: "Collapse child folders",action: "collapse"   },
  { icon: Terminal,      label: "Open shell here",       action: "open-shell" },
  "divider",
  { icon: Copy,          label: "Copy file path",        action: "copy-path"  },
  { icon: Link2,         label: "Copy link",             action: "copy-link"  },
  "divider",
  { icon: Download,      label: "Download folder",       action: "download"   },
  "divider",
  { icon: Trash2,        label: "Delete",                action: "delete",   danger: true },
];

export const FILE_MENU: MenuRow[] = [
  { icon: Pencil,   label: "Rename",        action: "rename"    },
  "divider",
  { icon: Copy,     label: "Copy file path",action: "copy-path" },
  { icon: Link2,    label: "Copy link",     action: "copy-link" },
  "divider",
  { icon: Download, label: "Download",      action: "download"  },
  "divider",
  { icon: Trash2,   label: "Delete",        action: "delete",  danger: true },
];

export interface NodeRowMenuProps {
  x: number; y: number;
  isDir: boolean;
  onAction: (action: MenuAction) => void;
  onClose: () => void;
}

export function NodeRowMenu({ x, y, isDir, onAction, onClose }: NodeRowMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const items = isDir ? DIR_MENU : FILE_MENU;

  const tipX = Math.min(x, window.innerWidth  - 210);
  const tipY = Math.min(y, window.innerHeight - (isDir ? 380 : 210));

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown",   key,  true);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown",   key,  true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed", top: tipY, left: tipX, zIndex: 99999,
        background: "#1a1a1a", border: "1px solid #2a2a2a",
        borderRadius: 8, padding: "3px",
        boxShadow: "0 8px 28px rgba(0,0,0,.75), 0 2px 8px rgba(0,0,0,.4)",
        minWidth: 196,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      data-testid="row-context-menu"
    >
      {items.map((row, i) => {
        if (row === "divider") {
          return <div key={`d-${i}`} style={{ height: 1, background: "#252525", margin: "2px 3px" }} />;
        }
        const { icon: Icon, label, action, danger } = row;
        return (
          <div
            key={action}
            role="menuitem"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onAction(action); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "5px 11px", borderRadius: 5, cursor: "pointer",
              fontSize: 12.5, color: danger ? "#f87171" : "#b4b4b4",
              transition: "background .08s, color .08s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = danger ? "rgba(239,68,68,.12)" : "#252525";
              (e.currentTarget as HTMLElement).style.color      = danger ? "#ef4444"             : "#f0f0f0";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color      = danger ? "#f87171" : "#b4b4b4";
            }}
            data-testid={`row-menu-${action}`}
          >
            <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
            {label}
          </div>
        );
      })}
    </div>
  );
}

export interface MoreBtnProps {
  nodeName: string;
  menuPos: { x: number; y: number } | null;
  hovered: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function MoreBtn({ nodeName, menuPos, hovered, onClick }: MoreBtnProps) {
  if (!hovered && menuPos === null) return null;
  return (
    <button
      onClick={onClick}
      onMouseDown={e => e.stopPropagation()}
      title="More options"
      data-testid={`btn-more-${nodeName}`}
      style={{
        flexShrink: 0, background: menuPos ? "#333" : "transparent",
        border: "none", cursor: "pointer", borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 18, height: 18, color: "#888",
        transition: "background .1s, color .1s",
        marginLeft: "auto",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#333"; (e.currentTarget as HTMLElement).style.color = "#d4d4d4"; }}
      onMouseLeave={e => { if (!menuPos) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#888"; } }}
    >
      <MoreHorizontal style={{ width: 13, height: 13 }} />
    </button>
  );
}
