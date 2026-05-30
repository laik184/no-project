import { FilePlus, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { ContextMenuState } from "./types";

interface ContextMenuProps {
  menu: ContextMenuState;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function ContextMenu({ menu, onNewFile, onNewFolder, onRename, onDelete }: ContextMenuProps) {
  if (!menu) return null;

  const items = [
    { label: "New File",   Icon: FilePlus,   onClick: onNewFile,   danger: false, testId: "context-new-file" },
    { label: "New Folder", Icon: FolderPlus, onClick: onNewFolder, danger: false, testId: "context-new-folder" },
    { label: "Rename",     Icon: Pencil,     onClick: onRename,    danger: false, testId: "context-rename" },
    { label: "Delete",     Icon: Trash2,     onClick: onDelete,    danger: true,  testId: "context-delete" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
      {/* Menu */}
      <div
        style={{
          position: "fixed", top: menu.y, left: menu.x, zIndex: 9999,
          background: "#1e1e1e", border: "1px solid #2e2e2e",
          borderRadius: 7, padding: "3px",
          boxShadow: "0 8px 24px rgba(0,0,0,.6), 0 2px 6px rgba(0,0,0,.4)",
          minWidth: 150,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
        data-testid="context-menu"
      >
        {items.map(({ label, Icon, onClick, danger, testId }, i) => (
          <div key={label}>
            {i === 3 && (
              <div style={{ height: 1, background: "#2a2a2a", margin: "2px 3px" }} />
            )}
            <div
              onClick={onClick}
              data-testid={testId}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 10px", borderRadius: 4, cursor: "pointer",
                fontSize: 12, color: danger ? "#f87171" : "#c4c4c4",
                transition: "background .1s, color .1s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = danger ? "rgba(239,68,68,.12)" : "#2a2a2a";
                (e.currentTarget as HTMLElement).style.color = danger ? "#ef4444" : "#f0f0f0";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = danger ? "#f87171" : "#c4c4c4";
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
