import { useState, useCallback } from "react";

type DiffFile = { path: string; proposed?: string; status?: string };
type DiffBatch = { id: string; files: DiffFile[]; status: string; createdAt: number };

export function useDiffQueue() {
  const [batches, setBatches] = useState<DiffBatch[]>([]);
  const enqueue = useCallback(async (files: DiffFile[]) => {
    const res = await fetch("/api/agent/diff-queue/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: null, files: files.map(f=>({ path: f.path, content: f.proposed })) }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setBatches(prev => [...prev, { id: data.jobId, files, status: 'queued', createdAt: Date.now() }]);
    return data.jobId;
  }, []);
  const clear = useCallback(()=> setBatches([]), []);
  return { batches, enqueue, clear };
}
