/**
 * client/src/features/collaboration/useExternalChangeWarning.ts
 *
 * Listens for 'file:external-change-blocked' events dispatched by
 * useEditorSync when an incoming SSE file.change cannot be applied
 * because the file is dirty in the editor.
 *
 * Shows a single non-spammy toast per file path (deduplicated with a
 * short cooldown so rapid writes don't flood the user).
 *
 * Mount once at the workspace level via useEffect — no JSX required.
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

const COOLDOWN_MS = 8_000; // min ms between toasts for the same file

export function useExternalChangeWarning(): void {
  const { toast } = useToast();
  const lastToast = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    function handler(e: Event) {
      const { filePath } = (e as CustomEvent<{ filePath: string }>).detail ?? {};
      if (!filePath) return;

      const now  = Date.now();
      const last = lastToast.current.get(filePath) ?? 0;
      if (now - last < COOLDOWN_MS) return;
      lastToast.current.set(filePath, now);

      const name = filePath.split("/").pop() ?? filePath;
      toast({
        title:       "File changed externally",
        description: `"${name}" was updated while you have unsaved edits. Save or discard your changes to reload it.`,
        duration:    7_000,
      });
    }

    window.addEventListener("file:external-change-blocked", handler);
    return () => window.removeEventListener("file:external-change-blocked", handler);
  }, [toast]);
}
