import { MoreHorizontal } from "lucide-react";

export const INDENT_W = 16;

export interface RowStyleOpts {
  depth: number;
  isActive: boolean; isFocused: boolean; hovered: boolean;
  isDragging: boolean; isDropTgt: boolean; isSelected: boolean;
}

export function getRowStyle(o: RowStyleOpts): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 4,
    height: 22, paddingLeft: 8 + o.depth * INDENT_W, paddingRight: 4,
    cursor: o.isDragging ? "grabbing" : "pointer",
    userSelect: "none", fontSize: 12, position: "relative",
    borderLeft: o.isActive ? "2px solid #3b82f6" : "2px solid transparent",
    background: o.isDropTgt   ? "rgba(59,130,246,.18)"
      : o.isDragging          ? "rgba(59,130,246,.04)"
      : o.isSelected          ? "rgba(59,130,246,.1)"
      : o.isActive            ? "#2a2a2a"
      : o.isFocused           ? "#1e2a3a"
      : o.hovered             ? "#252525"
      :                         "transparent",
    color: o.isActive ? "#f0f0f0" : o.hovered ? "#d4d4d4" : "#b4b4b4",
    transition: "background .1s, color .1s",
    outline: o.isDropTgt ? "1px dashed rgba(59,130,246,.5)"
      : o.isFocused     ? "1px solid rgba(59,130,246,.3)" : "none",
    outlineOffset: "-1px",
    opacity: o.isDragging ? 0.5 : 1,
  };
}

export function IndentGuides({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} style={{
          position: "absolute", left: 8 + i * INDENT_W + 5,
          top: 0, bottom: 0, width: 1,
          background: "#1e1e1e", pointerEvents: "none",
        }} />
      ))}
    </>
  );
}

export function DotButton({ visible, hasMenu, name, btnRef, onOpen }: {
  visible: boolean; hasMenu: boolean; name: string;
  btnRef: React.RefObject<HTMLButtonElement>;
  onOpen: (e: React.MouseEvent) => void;
}) {
  if (!visible) return null;
  return (
    <button
      ref={btnRef} onClick={onOpen} title="More actions"
      data-testid={`more-${name}`}
      style={{
        width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
        background: hasMenu ? "#333" : "transparent", border: "none", cursor: "pointer",
        borderRadius: 3, color: "#666", transition: "background .1s, color .1s",
        flexShrink: 0, marginLeft: "auto",
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#333"; el.style.color = "#c4c4c4"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (!hasMenu) el.style.background = "transparent"; el.style.color = "#666"; }}
    >
      <MoreHorizontal style={{ width: 12, height: 12 }} />
    </button>
  );
}

export interface DragHandlerOpts {
  nodeId: string; isDir: boolean; dragSourceId: string | null;
  onDragStart: (id: string, isDir: boolean) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (sourceId: string, targetId: string) => void;
}

export function buildDragHandlers(o: DragHandlerOpts) {
  return {
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; o.onDragStart(o.nodeId, o.isDir);
    },
    onDragOver: (e: React.DragEvent) => {
      if (o.isDir && o.dragSourceId && o.dragSourceId !== o.nodeId) {
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = "move"; o.onDragEnter(o.nodeId);
      }
    },
    onDragLeave: (e: React.DragEvent) => { e.stopPropagation(); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (o.dragSourceId && o.dragSourceId !== o.nodeId) o.onDrop(o.dragSourceId, o.nodeId);
    },
    onDragEnd: (e: React.DragEvent) => { e.stopPropagation(); o.onDragEnd(); },
  };
}
