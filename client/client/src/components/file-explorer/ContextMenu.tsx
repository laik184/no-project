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

  const itemStyle: React.CSSProperties = {
    padding: "4px 8px",
    cursor: "pointer",
    borderRadius: 4,
    fontSize: 13,
    color: "#e5e7eb",
    transition: "background 0.1s",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: menu.y,
        left: menu.x,
        background: "#020617",
        border: "1px solid #1f2937",
        borderRadius: 6,
        padding: 4,
        zIndex: 9999,
        minWidth: 140,
        boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
      }}
      data-testid="context-menu"
    >
      <div style={itemStyle} onClick={onNewFile}   data-testid="context-new-file">New File</div>
      <div style={itemStyle} onClick={onNewFolder} data-testid="context-new-folder">New Folder</div>
      <div style={itemStyle} onClick={onRename}    data-testid="context-rename">Rename</div>
      <div style={{ ...itemStyle, color: "#f97373" }} onClick={onDelete} data-testid="context-delete">
        Delete
      </div>
    </div>
  );
}
