import React from 'react';

interface LogEvent {
  ts:      number;
  payload: unknown;
}

function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;

  const p = payload as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof p['type']    === 'string') parts.push(p['type']);
  if (typeof p['message'] === 'string') parts.push(p['message']);
  if (typeof p['summary'] === 'string') parts.push(p['summary']);
  if (typeof p['status']  === 'string') parts.push(`status: ${p['status']}`);
  if (typeof p['phase']   === 'string') parts.push(`phase: ${p['phase']}`);
  if (typeof p['runId']   === 'string') parts.push(`run: ${String(p['runId']).slice(0, 8)}…`);
  if (typeof p['error']   === 'string') parts.push(`⚠ ${p['error'].slice(0, 120)}`);

  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(payload).slice(0, 200);
}

export default function LogsList({ events }: { events: LogEvent[] }) {
  return (
    <div style={{ height: 300, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
      {events.map((e, idx) => (
        <div key={idx} style={{ padding: 6, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 11, color: '#666' }}>{new Date(e.ts).toLocaleString()}</div>
          <div style={{ fontSize: 13, color: '#222' }}>{formatPayload(e.payload)}</div>
        </div>
      ))}
    </div>
  );
}
