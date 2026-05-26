
import React from 'react';
import { useAgiStream } from '../hooks/useAgiStream';

export default function Dashboard() {
  const events = useAgiStream();

  return (
    <div style={{ padding: 16 }}>
      <h2>AGI Live Dashboard</h2>
      <div style={{
        maxHeight: 400,
        overflow: 'auto',
        background: '#0b0b0b',
        color: '#00ff88',
        padding: 8,
        borderRadius: 6
      }}>
        {events.map((e, i) => (
          <pre key={i}>{JSON.stringify(e, null, 2)}</pre>
        ))}
      </div>
    </div>
  );
}
