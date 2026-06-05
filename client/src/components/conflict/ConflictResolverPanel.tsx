import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { toastError, toastSuccess, fetchWithToast } from '@/lib/app-error';
import ConflictBlock from './ConflictBlock';

export default function ConflictResolverPanel() {
  const [filePath,  setFilePath]  = useState('');
  const [merged,    setMerged]    = useState('');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const { toast } = useToast();

  async function prepare() {
    const data = await fetchWithToast(toast, '/api/solopilot/prepareConflict', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: filePath }),
    }, 'Prepare Failed');
    if (data) {
      setMerged((data.merged as string) ?? '');
      setConflicts((data.conflicts as any[]) ?? []);
    }
  }

  async function applyMerged() {
    const mergedContent = merged;
    const data = await fetchWithToast(toast, '/api/solopilot/resolveConflictApply', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: filePath, mergedContent }),
    }, 'Apply Failed');
    if (data) toastSuccess(toast, 'Merge Applied', `Written to ${filePath}`);
  }

  return (
    <div style={{ padding: 12 }}>
      <h3>Conflict Resolver</h3>
      <div>
        <input
          placeholder="Relative path (e.g. src/App.tsx)"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          style={{ width: '60%' }}
        />
        <button onClick={prepare} style={{ marginLeft: 8 }}>Prepare</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {conflicts.length === 0 && <div>No conflicts detected</div>}
        {conflicts.map((c, idx) => <ConflictBlock key={idx} conflict={c} filePath={filePath} />)}
      </div>
      <div style={{ marginTop: 12 }}>
        <h4>Merged Preview</h4>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 8 }}>{merged}</pre>
        <div style={{ marginTop: 8 }}>
          <button onClick={applyMerged}>Apply Merged</button>
        </div>
      </div>
    </div>
  );
}
