import React, { useState } from 'react';
import PatchList from './PatchList';
import DiffPreviewModal from './DiffPreviewModal';
import { useRealtimeEvent } from '@/realtime/useRealtimeStream';

export default function DiffPanel({ initialPatches }: { initialPatches?: any[] }) {
  const [patches, setPatches] = useState<any[]>(initialPatches || []);
  const [selected, setSelected] = useState<{ id?: string; [key: string]: any } | null>(null);

  useRealtimeEvent('console', (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.type === 'autoevolve:patch-list' && d.patches) {
        setPatches(d.patches as any[]);
      }
      if (d.type === 'autoevolve:patch-updated' && d.patch) {
        setPatches(prev => prev.map(p => p.id === (d.patch as any).id ? d.patch : p));
      }
    } catch {}
  });

  async function handleApply(patch: any) {
    try {
      const res = await fetch('/api/solopilot/applyPatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchId: patch.id, patch }),
      });
      const j = await res.json();
      if (j.ok) alert('Applied'); else alert('Apply failed: ' + (j.error || 'unknown'));
    } catch (e) { alert('Apply error: ' + String(e)); }
  }

  async function handleReject(patch: any) {
    try {
      const res = await fetch('/api/solopilot/rejectPatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchId: patch.id }),
      });
      const j = await res.json();
      if (j.ok) alert('Rejected'); else alert('Reject failed: ' + (j.error || 'unknown'));
    } catch (e) { alert('Reject error: ' + String(e)); }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <PatchList patches={patches} selectedId={selected?.id} onSelect={(p) => setSelected(p)} />
      <div style={{ flex: 1, padding: 12 }}>
        <h4>Patch Preview</h4>
        {!selected && <div>Select a patch to preview</div>}
        {selected && (
          <div>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 8 }}>
              {JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        )}
      </div>
      <DiffPreviewModal patch={selected} onClose={() => setSelected(null)} onApply={handleApply} onReject={handleReject} />
    </div>
  );
}
