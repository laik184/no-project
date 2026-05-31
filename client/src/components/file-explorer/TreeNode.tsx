import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, MoreHorizontal } from "lucide-react";
import { FileNode } from "./types";
import { fileIcon } from "./file-icon";
import { InlineInput } from "./InlineInput";
import { TreeNodeMenu } from "./TreeNodeMenu";

interface TreeNodeProps {
  node:               FileNode;
  depth:              number;
  activeFileName:     string;
  onSelect:           (node: FileNode) => void;
  onDelete:           (id: string) => void;
  onRename:           (id: string, newName: string) => void;
  onCreateInside?:    (type: "file" | "folder", name: string, parentId: string) => void;
  collapseRevision?:  number;
  showHidden?:        boolean;
  path?:              string;
  focusedId?:         string;
  onFocus?:           (id: string) => void;
}

export function TreeNode({
  node, depth, activeFileName, onSelect, onDelete, onRename,
  onCreateInside, collapseRevision = 0, showHidden = false, path = "",
  focusedId, onFocus,
}: TreeNodeProps) {
  const [open, setOpen]               = useState(depth < 2);
  const [renaming, setRenaming]       = useState(false);
  const [hovered, setHovered]         = useState(false);
  const [creatingInside, setCreating] = useState<"file" | "folder" | null>(null);
  const [localCollapse, setLocalCollapse] = useState(0);
  const [menu, setMenu]               = useState<{ x: number; y: number } | null>(null);
  const dotBtnRef                     = useRef<HTMLButtonElement>(null);

  const fullPath = path ? `${path}/${node.name}` : node.name;

  useEffect(() => {
    if (collapseRevision > 0) setOpen(false);
  }, [collapseRevision]);

  // P1 #2 — keyboard expand/collapse via custom event from FileTreePanel
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, expanded } = (e as CustomEvent).detail ?? {};
      if (id === node.id) setOpen(expanded);
    };
    window.addEventListener("rfe:treepanel-set-expanded", handler);
    return () => window.removeEventListener("rfe:treepanel-set-expanded", handler);
  }, [node.id]);

  const indent   = 8 + depth * 16;
  const isActive  = activeFileName === node.name;
  const isFocused = focusedId === node.id;
  const isDir     = node.type === "folder";

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4,
    height: 22, paddingLeft: indent, paddingRight: 4,
    cursor: "pointer", userSelect: "none", fontSize: 12,
    borderLeft: isActive ? "2px solid #3b82f6" : "2px solid transparent",
    background: isActive ? "#2a2a2a" : isFocused ? "#1e2a3a" : hovered ? "#252525" : "transparent",
    color: isActive ? "#f0f0f0" : hovered ? "#d4d4d4" : "#b4b4b4",
    transition: "background .1s, color .1s",
    outline: isFocused ? "1px solid rgba(59,130,246,.3)" : "none",
    outlineOffset: "-1px",
  };

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: rect.right + 4, y: rect.top });
  };

  const dotButton = hovered && !renaming && (
    <button
      ref={dotBtnRef}
      onClick={openMenu}
      title="More actions"
      data-testid={`more-${node.name}`}
      style={{
        width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
        background: menu ? "#333" : "transparent", border: "none", cursor: "pointer",
        borderRadius: 3, color: "#666", transition: "background .1s, color .1s",
        flexShrink: 0, marginLeft: "auto",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#333"; (e.currentTarget as HTMLElement).style.color = "#c4c4c4"; }}
      onMouseLeave={e => { if (!menu) { (e.currentTarget as HTMLElement).style.background = "transparent"; } (e.currentTarget as HTMLElement).style.color = "#666"; }}
    >
      <MoreHorizontal style={{ width: 12, height: 12 }} />
    </button>
  );

  const visibleChildren = (node.children ?? []).filter(
    (c) => showHidden || !c.name.startsWith(".")
  );

  const childCollapse = collapseRevision + localCollapse;

  if (isDir) {
    return (
      <div>
        <div
          style={rowStyle}
          role="treeitem"
          aria-expanded={open}
          aria-selected={isActive}
          tabIndex={isFocused ? 0 : -1}
          data-tree-row="true"
          data-tree-node-id={node.id}
          data-tree-type="folder"
          data-tree-expanded={String(open)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => { onFocus?.(node.id); setOpen((v) => !v); }}
          data-testid={`folder-${node.name}`}
        >
          <span style={{ color: "#555", flexShrink: 0, display: "flex" }}>
            {open
              ? <ChevronDown  style={{ width: 11, height: 11 }} />
              : <ChevronRight style={{ width: 11, height: 11 }} />}
          </span>
          {fileIcon(node.name, "folder", open)}
          {renaming ? (
            <InlineInput
              initialValue={node.name}
              onConfirm={(n) => { onRename(node.id, n); setRenaming(false); }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {node.name}
            </span>
          )}
          {dotButton}
        </div>

        {open && (
          <div role="group">
            {/* Inline create row inside this folder */}
            {creatingInside && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                paddingLeft: indent + 16 + 4, paddingRight: 6,
                height: 22, background: "#1e1e1e",
              }}>
                <InlineInput
                  initialValue={creatingInside === "file" ? "untitled.tsx" : "new-folder"}
                  onConfirm={(name) => {
                    onCreateInside?.(creatingInside, name, node.id);
                    setCreating(null);
                  }}
                  onCancel={() => setCreating(null)}
                />
              </div>
            )}
            {visibleChildren.map((child) => (
              <TreeNode
                key={child.id} node={child} depth={depth + 1}
                activeFileName={activeFileName} path={fullPath}
                onSelect={onSelect} onDelete={onDelete} onRename={onRename}
                onCreateInside={onCreateInside}
                collapseRevision={childCollapse} showHidden={showHidden}
                focusedId={focusedId} onFocus={onFocus}
              />
            ))}
          </div>
        )}

        {menu && (
          <TreeNodeMenu
            node={node} path={fullPath} x={menu.x} y={menu.y}
            onClose={() => setMenu(null)}
            onRename={() => { setRenaming(true); setOpen(true); }}
            onDelete={() => { if (window.confirm(`Delete "${node.name}"?`)) onDelete(node.id); }}
            onAddFile={() => { setOpen(true); setCreating("file"); }}
            onAddFolder={() => { setOpen(true); setCreating("folder"); }}
            onCollapse={() => setLocalCollapse(v => v + 1)}
            onDownload={async () => {
              const { default: JSZip } = await import("jszip");
              const zip = new JSZip();
              const add = (nodes: FileNode[], prefix = "") => {
                for (const n of nodes) {
                  const p = prefix ? `${prefix}/${n.name}` : n.name;
                  if (n.type === "file") zip.file(p, n.content ?? "");
                  else if (n.children?.length) add(n.children, p);
                  else zip.folder(p);
                }
              };
              if (node.children) add(node.children, node.name);
              const blob = await zip.generateAsync({ type: "blob" });
              const url  = URL.createObjectURL(blob);
              Object.assign(document.createElement("a"), { href: url, download: `${node.name}.zip` }).click();
              URL.revokeObjectURL(url);
            }}
          />
        )}
      </div>
    );
  }

  // ── File row ──────────────────────────────────────────────────────────────
  return (
    <div>
      <div
        style={rowStyle}
        role="treeitem"
        aria-selected={isActive}
        tabIndex={isFocused ? 0 : -1}
        data-tree-row="true"
        data-tree-node-id={node.id}
        data-tree-type="file"
        data-tree-expanded="false"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { if (!renaming) { onFocus?.(node.id); onSelect(node); } }}
        data-testid={`file-${node.name}`}
      >
        <span style={{ width: 11, flexShrink: 0 }} />
        {fileIcon(node.name, "file")}
        {renaming ? (
          <InlineInput
            initialValue={node.name}
            onConfirm={(n) => { onRename(node.id, n); setRenaming(false); }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
        )}
        {dotButton}
      </div>

      {menu && (
        <TreeNodeMenu
          node={node} path={fullPath} x={menu.x} y={menu.y}
          onClose={() => setMenu(null)}
          onRename={() => setRenaming(true)}
          onDelete={() => { if (window.confirm(`Delete "${node.name}"?`)) onDelete(node.id); }}
        />
      )}
    </div>
  );
}
