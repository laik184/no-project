import { useEffect } from "react";
import {
  FilePlus, FolderPlus, Pencil, Trash2, Copy, FileSymlink, Files,
  Clipboard, Scissors, ClipboardPaste, Pin, PinOff, History,
} from "lucide-react";
import { ContextMenuState, ClipboardState } from "./types";

interface ContextMenuProps {
  menu:          ContextMenuState;
  targetPath?:   string;
  onNewFile:     () => void;
  onNewFolder:   () => void;
  onRename:      () => void;
  onDelete:      () => void;
  onDuplicate?:  () => void;
  onClose?:      () => void;
  onCopy?:       () => void;
  onCut?:        () => void;
  onPaste?:      () => void;
  onPin?:        () => void;
  onUnpin?:      () => void;
  onHistory?:    () => void;
  isPinned?:     boolean;
  clipboard?:    ClipboardState;
}

function copyToClipboard(text: string) {
  try { navigator.clipboard.writeText(text); } catch {}
}

export function ContextMenu({
  menu, targetPath = "", onNewFile, onNewFolder, onRename, onDelete,
  onDuplicate, onClose,
  onCopy, onCut, onPaste, onPin, onUnpin, onHistory,
  isPinned, clipboard,
}: ContextMenuProps) {
  useEffect(() => {
    if (!menu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose?.(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [menu, onClose]);

  if (!menu) return null;

  const isDir        = menu.isDir;
  const relativePath = targetPath.replace(/^\.?\/?[^/]+\//, "");
  const canPaste     = !!clipboard;

  type Item = {
    label:   string;
    Icon:    React.ElementType;
    onClick: () => void;
    danger?: boolean;
    testId:  string;
    hidden?: boolean;
  };

  const items: Item[] = [
    { label: "New File",   Icon: FilePlus,   onClick: onNewFile,   testId: "context-new-file"   },
    { label: "New Folder", Icon: FolderPlus, onClick: onNewFolder, testId: "context-new-folder" },
    { label: "Rename",     Icon: Pencil,     onClick: onRename,    testId: "context-rename"     },
    { label: "Duplicate",  Icon: Files,      onClick: () => { onDuplicate?.(); onClose?.(); }, testId: "context-duplicate" },
    { label: "Copy Path",          Icon: Copy,        onClick: () => { copyToClipboard(targetPath); onClose?.(); },                   testId: "context-copy-path"     },
    { label: "Copy Relative Path", Icon: FileSymlink, onClick: () => { copyToClipboard(relativePath || targetPath); onClose?.(); },   testId: "context-copy-rel-path" },
    { label: "Copy File",  Icon: Clipboard,      onClick: () => { onCopy?.();  onClose?.(); }, testId: "context-copy-file",  hidden: isDir },
    { label: "Cut File",   Icon: Scissors,       onClick: () => { onCut?.();   onClose?.(); }, testId: "context-cut-file",   hidden: isDir },
    { label: "Paste Here", Icon: ClipboardPaste, onClick: () => { onPaste?.(); onClose?.(); }, testId: "context-paste",      hidden: !canPaste },
    { label: isPinned ? "Unpin File" : "Pin File", Icon: isPinned ? PinOff : Pin, onClick: () => { isPinned ? onUnpin?.() : onPin?.(); onClose?.(); }, testId: "context-pin", hidden: isDir },
    { label: "View History", Icon: History,  onClick: () => { onHistory?.(); onClose?.(); }, testId: "context-history", hidden: isDir },
    { label: "Delete",     Icon: Trash2,     onClick: onDelete, danger: true, testId: "context-delete" },
  ];

  const visible = items.filter(it => !it.hidden);

  const dividerBefore = new Set<number>();
  dividerBefore.add(2);
  const copyFileIdx = visible.findIndex(i => i.testId === "context-copy-file");
  if (copyFileIdx !== -1) dividerBefore.add(copyFileIdx);
  const pinIdx = visible.findIndex(i => i.testId === "context-pin");
  if (pinIdx !== -1) dividerBefore.add(pinIdx);
  const historyIdx = visible.findIndex(i => i.testId === "context-history");
  if (historyIdx !== -1 && historyIdx !== pinIdx + 1) dividerBefore.add(historyIdx);
  dividerBefore.add(visible.length - 1);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
      <div
        role="menu"
        aria-label="File context menu"
        style={{
          position: "fixed", top: menu.y, left: menu.x, zIndex: 9999,
          background: "#1a1a1a", border: "1px solid #2a2a2a",
          borderRadius: 7, padding: "3px",
          boxShadow: "0 8px 28px rgba(0,0,0,.7), 0 2px 8px rgba(0,0,0,.4)",
          minWidth: 186,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
        data-testid="context-menu"
      >
        {visible.map(({ label, Icon, onClick, danger, testId }, i) => (
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
              {label === "Cut File" && clipboard?.op === "cut" && clipboard.path === targetPath && (
                <span style={{ fontSize: 9, color: "#555", marginLeft: "auto" }}>✓</span>
              )}
              {label === "Copy File" && clipboard?.op === "copy" && clipboard.path === targetPath && (
                <span style={{ fontSize: 9, color: "#555", marginLeft: "auto" }}>✓</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
