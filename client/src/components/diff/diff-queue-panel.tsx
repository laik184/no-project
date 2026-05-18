import React from 'react';
import { useDiffQueue } from '@/state/diffQueue';

export default function DiffQueuePanel() {
  const { batches, clear } = useDiffQueue();
  return (
    <div className="fixed right-4 top-16 z-50 w-96 max-h-[60vh] overflow-auto bg-black/60 border p-3 rounded">
      <div className="flex items-center justify-between mb-2">
        <strong>Diff Queue</strong>
        <button onClick={() => clear()} className="text-xs">Clear</button>
      </div>
      {batches.length === 0 ? (
        <div className="text-sm text-gray-400">No pending diff batches.</div>
      ) : batches.map((b) => (
        <div key={b.id} className="mb-2 p-2 border rounded bg-black/20">
          <div className="flex justify-between text-xs text-gray-300">
            {b.id} <span>{b.status}</span>
          </div>
          <div className="text-sm mt-2">
            {b.files.map((f) => (
              <div key={f.path} className="flex justify-between">
                <span className="truncate">{f.path}</span>
                <span className="text-xs">{f.status || "pending"}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
