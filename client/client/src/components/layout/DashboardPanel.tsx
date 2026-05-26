import React, { useState, useEffect, useRef } from 'react';
import { useRealtimeEvent } from '@/realtime/useRealtimeStream';

export default function DashboardPanel() {
  const [events, setEvents] = useState<Array<{ ts: number; payload: unknown }>>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/solopilot/dashboard/history?limit=200')
      .then(r => r.json())
      .then(j => { if (j.ok) setEvents(j.history || []); setHistoryLoaded(true); })
      .catch(() => setHistoryLoaded(true));
  }, []);

  const push = (payload: unknown) =>
    setEvents(prev => [{ ts: Date.now(), payload }].concat(prev).slice(0, 500));

  useRealtimeEvent('agent',     push);
  useRealtimeEvent('lifecycle', push);

  return (
    <div style={{ padding: 12 }}>
      <h3>AGI Dashboard</h3>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h4>Timeline (recent events)</h4>
          <div style={{ height: 300, overflow: 'auto', border: '1px solid #eee', padding: 8, background: '#fff' }}>
            {events.map((ev, idx) => (
              <div key={idx} style={{ padding: 6, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 11, color: '#666' }}>{new Date(ev.ts).toLocaleString()}</div>
                <div style={{ fontSize: 13 }}>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(ev.payload, null, 2)}</pre>
                </div>
              </div>
            ))}
            {events.length === 0 && <div style={{ color: '#888' }}>No events yet</div>}
          </div>
        </div>
        <div style={{ width: 360 }}>
          <h4>Control</h4>
          <div style={{ marginBottom: 8 }}>
            <button onClick={async () => {
              const res = await fetch('/api/solopilot/dashboard/history?limit=50');
              const j = await res.json();
              if (j.ok) alert('Loaded ' + (j.history?.length ?? 0) + ' events');
              else alert('fail');
            }}>Reload History</button>
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
