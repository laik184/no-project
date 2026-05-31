import { useEffect } from "react";
import { FilePlus, FolderPlus, Pencil, Trash2, Copy, FileSymlink, Files } from "lucide-react";
import { ContextMenuState } from "./types";

interface ContextMenuProps {
  menu:        ContextMenuState;
  targetPath?: string;
  onNewFile:   () => void;
  onNewFolder: () => void;
  onRename:    () => void;
  onDelete:    () => void;
  onClose?:    () => void;
}

function copyToClipboard(text: string) {
  try { navigator.clipboard.writeText(text); } catch {}
}

export function ContextMenu({
  menu, targetPath = "", onNewFile, onNewFolder, onRename, onDelete, onClose,
}: ContextMenuProps) {
  // P1 #5 — ESC dismisses context menu, no memory leaks
  useEffect(() => {
    if (!menu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose?.(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [menu, onClose]);

  if (!menu) return null;

  const relativePath = targetPath.replace(/^\.?\/?[^/]+\//, "");

  const items: Array<{
    label:   string;
    Icon:    React.ElementType;
    onClick: () => void;
    danger?: boolean;
    testId:  string;
  }> = [
    { label: "New File",           Icon: FilePlus,    onClick: onNewFile,                                          testId: "context-new-file"      },
    { label: "New Folder",         Icon: FolderPlus,  onClick: onNewFolder,                                        testId: "context-new-folder"    },
    { label: "Rename",             Icon: Pencil,      onClick: onRename,                                           testId: "context-rename"        },
    { label: "Duplicate",          Icon: Files,       onClick: () => {},                                           testId: "context-duplicate"     },
    { label: "Copy Path",          Icon: Copy,        onClick: () => copyToClipboard(targetPath),                  testId: "context-copy-path"     },
    { label: "Copy Relative Path", Icon: FileSymlink, onClick: () => copyToClipboard(relativePath || targetPath),  testId: "context-copy-rel-path" },
    { label: "Delete",             Icon: Trash2,      onClick: onDelete, danger: true,                             testId: "context-delete"        },
  ];

  const dividerBefore = new Set([2, items.length - 1]);

  return (
    <>
      {/* Backdrop — catches outside clicks */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} />

      {/* Menu */}
      <div
        role="menu"
        aria-label="File context menu"
        style={{
          position: "fixed", top: menu.y, left: menu.x, zIndex: 9999,
          background: "#1a1a1a", border: "1px solid #2a2a2a",
          borderRadius: 7, padding: "3px",
          boxShadow: "0 8px 28px rgba(0,0,0,.7), 0 2px 8px rgba(0,0,0,.4)",
          minWidth: 172,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
        data-testid="context-menu"
      >
        {items.map(({ label, Icon, onClick, danger, testId }, i) => (
          <div key={label}>
            {dividerBefore.has(i) && (
              <div style={{ height: 1, background: "#252525", margin: "2px 3px" }} />
            )}
            <div
              role="menuitem"
              tabIndex={-1}
              onClick={onClick}
              data-testid={testId}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 10px", borderRadius: 4, cursor: "pointer",
                fontSize: 12, color: danger ? "#f87171" : "#b4b4b4",
                transition: "background .1s, color .1s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = danger ? "rgba(239,68,68,.12)" : "#252525";
                (e.currentTarget as HTMLElement).style.color      = danger ? "#ef4444"             : "#f0f0f0";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color      = danger ? "#f87171" : "#b4b4b4";
              }}
            >
              <Icon style={{ width: 12, height: 12, flexShrink: 0 }} />
              {label}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
