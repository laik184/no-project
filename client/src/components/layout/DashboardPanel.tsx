import React, { useState, useEffect } from 'react';
import { useRealtimeEvent } from '@/realtime/useRealtimeStream';
import { useToast } from '@/hooks/use-toast';
import { toastError, toastSuccess } from '@/lib/app-error';

type EventEntry = { ts: number; type?: string; payload: unknown };

function formatPayload(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const parts: string[] = [];
    if (p.type)    parts.push(String(p.type));
    if (p.message) parts.push(String(p.message));
    if (p.status)  parts.push(`status: ${p.status}`);
    if (p.phase)   parts.push(`phase: ${p.phase}`);
    if (p.runId)   parts.push(`run: ${String(p.runId).slice(0, 8)}…`);
    if (parts.length > 0) return parts.join(' · ');
  }
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
}

export default function DashboardPanel() {
  const [events,        setEvents]        = useState<EventEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/solopilot/dashboard/history?limit=200')
      .then(r => r.json())
      .then(j => { if (j.ok) setEvents((j.history ?? []).map((e: any) => ({ ts: e.ts ?? Date.now(), payload: e }))); })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, []);

  const push = (payload: unknown) =>
    setEvents(prev => [{ ts: Date.now(), payload }].concat(prev).slice(0, 500));

  useRealtimeEvent('agent',     push);
  useRealtimeEvent('lifecycle', push);

  async function reloadHistory() {
    try {
      const res = await fetch('/api/solopilot/dashboard/history?limit=50');
      const j   = await res.json();
      if (j.ok) {
        setEvents((j.history ?? []).map((e: any) => ({ ts: e.ts ?? Date.now(), payload: e })));
        toastSuccess(toast, 'History Reloaded', `${j.history?.length ?? 0} events loaded.`);
      } else {
        toastError(toast, j?.error ?? 'Failed to reload history', 'Reload Failed');
      }
    } catch (e) {
      toastError(toast, e, 'Reload Failed');
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <h3>AGI Dashboard</h3>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h4>Timeline (recent events)</h4>
          <div style={{ height: 300, overflow: 'auto', border: '1px solid #eee', padding: 8, background: '#fff' }}>
            {events.length === 0 && historyLoaded && <div style={{ color: '#888' }}>No events yet</div>}
            {events.map((ev, idx) => (
              <div key={idx} style={{ padding: 6, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 11, color: '#666' }}>{new Date(ev.ts).toLocaleString()}</div>
                <div style={{ fontSize: 13, color: '#222' }}>{formatPayload(ev.payload)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 360 }}>
          <h4>Control</h4>
          <div style={{ marginBottom: 8 }}>
            <button onClick={reloadHistory}>Reload History</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <h5>Quick Stats</h5>
            <div>Events cached: {events.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
