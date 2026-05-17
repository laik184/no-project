import WebPanel from '../layout/WebPanel';
import { ConsolePanel } from '../console';
import DashboardPanel from '../layout/DashboardPanel';
import ConflictResolverPanel from '../conflict/ConflictResolverPanel';
import React, { useState, useRef, useEffect } from 'react';
import PatchDiffModal from '../diff/PatchDiffModal';
import { useRealtimeEvent } from '@/realtime/useRealtimeStream';

export default function SolopilotArchitectureModal({ onClose }: { onClose?: () => void }) {
  const [intent, setIntent] = useState('');
  const [arch, setArch] = useState<any | null>(null);
  const logBuffer = useRef<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [evolveHistory, setEvolveHistory] = useState<any>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [resultMap, setResultMap] = useState<any>({});

  useEffect(() => {
    const iv = setInterval(() => {
      if (logBuffer.current.length > 0) {
        setLogs(prev => [...prev, ...logBuffer.current].slice(-500));
        logBuffer.current = [];
      }
    }, 300);
    return () => clearInterval(iv);
  }, []);

  useRealtimeEvent('console', (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.type === 'autoevolve:finished') setEvolveHistory(d.result);
    } catch {}
  });

  async function startAutoEvolve() {
    setStatus('evolving...');
    try {
      const res = await fetch('/api/solopilot/autoevolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent }),
      });
      const d = await res.json();
      if (d.ok) alert('Auto-evolve started. Monitor SSE stream.');
    } catch (e) {
      alert('Auto-evolve failed: ' + String(e));
    }
    setStatus('done');
  }

  async function genArch() {
    setStatus('generating...');
    const res = await fetch('/api/solopilot/architecture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent }),
    });
    const d = await res.json();
    setArch(d);
    setStatus('done');
  }

  async function generateAndStage(changeIdx: number) {
    setStatus('staging...');
    try {
      const change = getChange(changeIdx);
      const res = await fetch('/api/solopilot/applyChange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change, applyNow: false }),
      });
      const d = await res.json();
      setResultMap((prev: any) => ({ ...prev, [changeIdx]: d.ok ? 'staged' : 'failed' }));
      alert('Staged patches: ' + (d.staged ? d.staged.length : 0));
      await genArch();
    } catch (e) {
      alert('Failed: ' + String(e));
    }
    setStatus('done');
  }

  async function stageAndApply(changeIdx: number) {
    setStatus('applying...');
    try {
      const change = getChange(changeIdx);
      const res = await fetch('/api/solopilot/applyChange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change, applyNow: true }),
      });
      const d = await res.json();
      setResultMap((prev: any) => ({ ...prev, [changeIdx]: d.batchId ? 'applied' : 'failed' }));
      alert('Apply triggered. batchId: ' + (d.batchId || 'n/a'));
      await genArch();
    } catch (e) {
      alert('Failed: ' + String(e));
    }
    setStatus('done');
  }

  function normalizeArray(raw: any) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((it, idx) => typeof it === 'string'
        ? { id: 'chg-' + idx, title: it.slice(0, 80), description: it }
        : (it.description || it.title
          ? { id: it.id || 'chg-' + idx, title: it.title || it.description.slice(0, 80), description: it.description || it.title }
          : { id: it.id || 'chg-' + idx, title: JSON.stringify(it).slice(0, 80), description: String(it) }
        ));
    }
    if (typeof raw === 'object') {
      return Object.keys(raw).map(k => ({ id: k, title: k, description: String(raw[k]) }));
    }
    return [];
  }

  function getChange(idx: number) {
    return arch && arch.plan && arch.plan.architecture &&
      (arch.plan.architecture.recommendedChanges || arch.plan.architecture.recommended || arch.plan.architecture.changes)
      ? (arch.plan.architecture.recommendedChanges || arch.plan.architecture.recommended || arch.plan.architecture.changes)[idx]
      : null;
  }

  async function viewDiff(idx: number) {
    const change = getChange(idx);
    if (!change) return;
    setDiff("Patch Diff for: " + (change.title || change.id) + "\n\n" + change.description);
  }

  return (
    <div style={{ padding: 12, color: '#ddd', width: '90%', height: '90%', overflow: 'auto', background: '#011018' }}>
      <div style={{ marginTop: 12 }}><WebPanel /></div>
      <div style={{ marginTop: 12 }}><ConsolePanel /></div>
      <div style={{ marginTop: 12 }}><DashboardPanel /></div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3>Solopilot Architecture Playbook</h3>
        <button onClick={() => onClose && onClose()}>Close</button>
      </div>

      <textarea
        value={intent}
        onChange={e => setIntent(e.target.value)}
        style={{ width: '100%', height: 120, fontFamily: 'monospace' }}
        placeholder='Describe high-level system goal'
      />

      <div style={{ marginTop: 8 }}>
        <button onClick={genArch} disabled={!intent}>Generate Architecture</button>
        <button style={{ marginLeft: 8 }} onClick={startAutoEvolve}>Start Auto-Evolve</button>
        <span style={{ marginLeft: 8 }}>{status}</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Architecture Result</h4>
        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
          {JSON.stringify(arch, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Recommended Changes</h4>
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {arch && arch.plan && arch.plan.architecture
            ? normalizeArray(
              arch.plan.architecture.recommendedChanges ||
              arch.plan.architecture.recommended ||
              arch.plan.architecture.changes
            ).map((c: any, idx: number) => (
              <div key={idx} style={{ padding: 8, borderBottom: '1px solid #222' }}>
                <div><strong>{c.title || ('Change ' + (idx + 1))}</strong></div>
                <div style={{ fontSize: 12, color: '#aaa', whiteSpace: 'pre-wrap' }}>{c.description}</div>
                <div style={{ marginTop: 4 }}>
                  {resultMap[idx] === 'staged' && <span style={{ color: 'yellow' }}>Staged</span>}
                  {resultMap[idx] === 'applied' && <span style={{ color: 'lightgreen' }}>Applied</span>}
                  {resultMap[idx] === 'failed' && <span style={{ color: 'red' }}>Failed</span>}
                </div>
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => generateAndStage(idx)}>Generate & Stage</button>
                  <button style={{ marginLeft: 8 }} onClick={() => stageAndApply(idx)}>Stage & Apply</button>
                  <button style={{ marginLeft: 8 }} onClick={() => viewDiff(idx)}>View Diff</button>
                </div>
              </div>
            ))
            : <div style={{ color: '#888' }}>No recommended changes found.</div>
          }
        </div>
      </div>

      {diff && <PatchDiffModal diff={diff} onClose={() => setDiff(null)} />}
      <div style={{ marginTop: 18 }}><ConflictResolverPanel /></div>
    </div>
  );
}
