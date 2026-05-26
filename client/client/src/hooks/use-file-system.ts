import { useCallback, useEffect, useState } from "react";


async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type FsNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FsNode[];
};

export type OpenedFile = {
  path: string;
  content: string;
  baseHash: string | null;
};

type UseFileSystemResult = {
  tree: FsNode[];
  activeFile: OpenedFile | null;
  setActiveFile: (file: OpenedFile | null) => void;
  refreshTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  saveFile: (path: string, content: string) => Promise<void>;
  isSaving: boolean;
  undoFile: (path: string) => Promise<void>;
};

export function useFileSystem(): UseFileSystemResult {
  const [tree, setTree] = useState<FsNode[]>([]);
  const [activeFile, setActiveFile] = useState<OpenedFile | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refreshTree = useCallback(async () => {
    try {
      const res = await fetch("/api/fs/tree");
      if (!res.ok) {
        console.error("Failed to fetch workspace tree", await res.text());
        return;
      }
      const data = (await res.json()) as FsNode[];
      setTree(data);
    } catch (error) {
      console.error("FS tree error", error);
    }
  }, []);

  const openFile = useCallback(async (path: string) => {
    try {
      const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        console.error("Failed to open file", await res.text());
        return;
      }
      const data = (await res.json()) as { content: string };
      const baseHash = await sha256(data.content ?? "");
      setActiveFile({ path, content: data.content, baseHash });
    } catch (error) {
      console.error("FS open error", error);
    }
  }, []);

  const saveFile = useCallback(
    async (path: string, content: string) => {
      try {
        setIsSaving(true);

        // Try conflict-check only if we have a baseHash for this file
        const target = activeFile && activeFile.path === path ? activeFile : null;
        const baseHash = target?.baseHash ?? null;

        if (baseHash) {
          try {
            const conflictRes = await fetch("/api/fs/conflict-check", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ path, hash: baseHash }),
            });

            if (conflictRes.ok) {
              const conflictData = (await conflictRes.json()) as { conflict: boolean };

              if (conflictData.conflict) {
                // Instead of silently auto-merging, surface a conflict to the UI
                let serverContent = "";
                try {
                  const detailsRes = await fetch("/api/fs/conflict-details", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ path, hash: baseHash }),
                  });
                  if (detailsRes.ok) {
                    const details = (await detailsRes.json()) as {
                      serverContent?: string;
                      serverVersionId?: string;
                      serverHash?: string;
                    };
                    serverContent = details.serverContent ?? "";
                  }
                } catch (e) {
                  console.error("Failed to load conflict details", e);
                }

                throw {
                  type: "conflict",
                  path,
                  baseHash,
                  serverContent,
                  clientContent: content,
                };
              }
            }
          } catch (error) {
            console.error("Conflict/merge flow failed, falling back to normal save", error);
          }
        }

        // No baseHash or no conflict -> normal save
        const res = await fetch("/api/fs/file", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path, content }),
        });
        if (!res.ok) {
          console.error("Failed to save file", await res.text());
        } else {
          void refreshTree();
          const newHash = await sha256(content);
          setActiveFile((prev) => {
            if (!prev || prev.path !== path) return prev;
            return {
              ...prev,
              content,
              baseHash: newHash,
            };
          });
        }
      } catch (error) {
        console.error("FS save error", error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [activeFile, refreshTree],
  );

  const undoFile = useCallback(async (path: string) => {
    try {
      const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        console.error("Failed to undo file", await res.text());
        return;
      }
      const data = (await res.json()) as { content: string };
      const baseHash = await sha256(data.content ?? "");
      setActiveFile({ path, content: data.content, baseHash });
    } catch (error) {
      console.error("FS undo error", error);
    }
  }, []);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  return {
    tree,
    activeFile,
    setActiveFile,
    refreshTree,
    openFile,
    saveFile,
    undoFile,
    isSaving,
  };
}