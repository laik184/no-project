import { FileNode } from "./types";
import { flattenVisibleIds } from "./file-tree-panel-helpers";

export interface UseFileTreeKeyboardOpts {
  tree: FileNode[];
  showHidden: boolean;
  focusedId: string | undefined;
  setFocusedId: (id: string | undefined) => void;
  expandedIdsRef: React.MutableRefObject<Set<string>>;
  treeRef: React.RefObject<HTMLDivElement>;
  onSelect: (node: FileNode) => void;
}

export function useFileTreeKeyboard(o: UseFileTreeKeyboardOpts) {
  const findNode = (id: string): FileNode | undefined => {
    const walk = (nodes: FileNode[]): FileNode | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) { const f = walk(n.children); if (f) return f; }
      }
    };
    return walk(o.tree);
  };

  return (e: React.KeyboardEvent) => {
    const visible = flattenVisibleIds(
      o.showHidden ? o.tree : o.tree.filter(n => !n.name.startsWith(".")),
      o.expandedIdsRef.current,
    );
    if (!visible.length) return;
    const curIdx = o.focusedId ? visible.indexOf(o.focusedId) : -1;

    const scrollTo = (id: string) =>
      o.treeRef.current?.querySelector(`[data-tree-node-id="${id}"]`)?.scrollIntoView({ block: "nearest" });

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextId = visible[Math.min(visible.length - 1, curIdx + 1)];
        if (nextId) { o.setFocusedId(nextId); scrollTo(nextId); }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevId = visible[Math.max(0, curIdx - 1)];
        if (prevId) { o.setFocusedId(prevId); scrollTo(prevId); }
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (o.focusedId) {
          const node = findNode(o.focusedId);
          if (node?.type === "folder" && !o.expandedIdsRef.current.has(o.focusedId)) {
            o.expandedIdsRef.current.add(o.focusedId);
            window.dispatchEvent(new CustomEvent("rfe:treepanel-set-expanded", { detail: { id: o.focusedId, expanded: true } }));
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (o.focusedId) {
          const node = findNode(o.focusedId);
          if (node?.type === "folder" && o.expandedIdsRef.current.has(o.focusedId)) {
            o.expandedIdsRef.current.delete(o.focusedId);
            window.dispatchEvent(new CustomEvent("rfe:treepanel-set-expanded", { detail: { id: o.focusedId, expanded: false } }));
          }
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (o.focusedId) {
          const node = findNode(o.focusedId);
          if (!node) break;
          if (node.type === "folder") {
            const expanded = o.expandedIdsRef.current.has(o.focusedId);
            if (expanded) o.expandedIdsRef.current.delete(o.focusedId);
            else          o.expandedIdsRef.current.add(o.focusedId);
            window.dispatchEvent(new CustomEvent("rfe:treepanel-set-expanded", { detail: { id: o.focusedId, expanded: !expanded } }));
          } else { o.onSelect(node); }
        }
        break;
      }
      case " ": {
        e.preventDefault();
        if (o.focusedId) { const node = findNode(o.focusedId); if (node) o.onSelect(node); }
        break;
      }
      case "Home": {
        e.preventDefault();
        const firstId = visible[0];
        if (firstId) { o.setFocusedId(firstId); scrollTo(firstId); }
        break;
      }
      case "End": {
        e.preventDefault();
        const lastId = visible[visible.length - 1];
        if (lastId) { o.setFocusedId(lastId); scrollTo(lastId); }
        break;
      }
    }
  };
}
