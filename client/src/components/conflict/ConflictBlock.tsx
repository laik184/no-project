import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { toastError, toastSuccess, fetchWithToast } from '@/lib/app-error';

export default function ConflictBlock({ conflict, filePath }: { conflict: any; filePath: string }) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const { toast } = useToast();

  async function askAI() {
    const data = await fetchWithToast(toast, '/api/solopilot/aiResolve', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: filePath, conflict }),
    }, 'AI Resolve Failed');
    if (data) {
      const s = data.suggestion as any;
      setSuggestion(s?.suggestion ?? s ?? null);
    }
  }

  async function aiMerge() {
    const data = await fetchWithToast(toast, '/api/solopilot/aiMerge', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: filePath, conflict }),
    }, 'AI Merge Failed');
    if (!data) return;

    const mergedContent = data.merged as string;
    setSuggestion(mergedContent);

    if (window.confirm('Apply merged block to file?')) {
      const applied = await fetchWithToast(toast, '/api/solopilot/resolveConflictApply', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path: filePath, mergedContent }),
      }, 'Apply Failed');
      if (applied) toastSuccess(toast, 'Merged Applied', `Changes written to ${filePath}`);
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: '#333' }}>Conflict at line {conflict.index + 1}</div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ fontWeight: 600 }}>LOCAL</div>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 8 }}>{conflict.local}</pre>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>REMOTE</div>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 8 }}>{conflict.remote}</pre>
        </div>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button onClick={askAI}>Ask AI to Resolve</button>
        <button onClick={aiMerge}>AI Auto-Merge</button>
      </div>
      {suggestion && (
        <div style={{ marginTop: 8, background: '#f7f7f7', padding: 8 }}>
          <strong>AI Suggestion:</strong>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{suggestion}</pre>
        </div>
      )}
    </div>
  );
}
