import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { toastError } from '@/lib/app-error';

interface CrashAnalysis {
  summary?:      string;
  errorType?:    string;
  stackFrames?:  string[];
  suggestions?:  string[];
  rawResponse?:  string;
  [key: string]: unknown;
}

export default function CrashPanel() {
  const [log,    setLog]    = useState('');
  const [result, setResult] = useState<CrashAnalysis | null>(null);
  const [busy,   setBusy]   = useState(false);
  const { toast } = useToast();

  async function analyze() {
    if (!log.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/mobile/crash/parse', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ log }),
      });
      const j = await r.json();
      if (r.ok && j.ok !== false) {
        setResult(j as CrashAnalysis);
      } else {
        toastError(toast, j?.error ?? 'Analysis failed', 'Analysis Failed');
      }
    } catch (e) {
      toastError(toast, e, 'Analysis Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', marginTop: 12 }}>
      <h4>Mobile Crash Analyzer</h4>
      <textarea
        style={{ width: '100%', height: 120 }}
        value={log}
        onChange={(e) => setLog(e.target.value)}
        placeholder="Paste crash log here…"
      />
      <button onClick={analyze} disabled={busy} style={{ marginTop: 8 }}>
        {busy ? 'Analyzing…' : 'Analyze Crash'}
      </button>
      {result && (
        <div style={{ marginTop: 12 }}>
          {result.summary && (
            <div style={{ marginBottom: 8, fontWeight: 600 }}>{result.summary}</div>
          )}
          {result.errorType && (
            <div style={{ marginBottom: 4, color: '#dc2626' }}>Error: {result.errorType}</div>
          )}
          {result.suggestions && result.suggestions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggestions:</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {result.stackFrames && result.stackFrames.length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: '#666' }}>Stack frames ({result.stackFrames.length})</summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, background: '#f9f9f9', padding: 8, marginTop: 4 }}>
                {result.stackFrames.join('\n')}
              </pre>
            </details>
          )}
          {!result.summary && !result.errorType && (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f9f9f9', padding: 8 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
