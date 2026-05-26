
import React, { useState } from 'react';

export default function CrashPanel(){
  const [log, setLog] = useState('');
  const [result, setResult] = useState(null);

  async function analyze(){
    const r = await fetch('/api/mobile/crash/parse', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ log })
    });
    const j = await r.json();
    setResult(j);
  }

  return (
    <div style={{padding:12, border:'1px solid #ddd', marginTop:12}}>
      <h4>Mobile Crash Analyzer</h4>
      <textarea style={{width:'100%',height:120}} value={log} onChange={e=>setLog(e.target.value)} />
      <button onClick={analyze}>Analyze Crash</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
