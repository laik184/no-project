
import React from 'react';

type DiffLine = { type: 'context'|'add'|'del', text: string, ln?: number };

function simpleLineDiff(oldText: string, newText: string): DiffLine[] {
  const a = (oldText||'').split('\n');
  const b = (newText||'').split('\n');
  const lines: DiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let i=0;i<max;i++){
    const la = a[i];
    const lb = b[i];
    if (la === lb) {
      lines.push({type:'context', text: la ?? '', ln: i+1});
    } else {
      if (la !== undefined) lines.push({type:'del', text: la, ln: i+1});
      if (lb !== undefined) lines.push({type:'add', text: lb, ln: i+1});
    }
  }
  return lines;
}

export default function DiffViewer({ oldContent, newContent }: { oldContent: string, newContent: string }) {
  const lines = simpleLineDiff(oldContent, newContent);
  return (
    <div style={{fontFamily: 'monospace', fontSize: 12, maxHeight: 400, overflow: 'auto', border: '1px solid #2a2a2a', padding:8, background:'#0b0b0b', color:'#ddd' }}>
      {lines.map((ln, idx) => (
        <div key={idx} style={{display:'flex', gap:8, background: ln.type==='context' ? 'transparent' : ln.type==='add' ? 'rgba(30,80,30,0.2)' : 'rgba(80,30,30,0.2)'}}>
          <div style={{width:50, color:'#888'}}>{ln.ln ?? ''}</div>
          <div style={{whiteSpace:'pre-wrap'}}>{ln.text}</div>
        </div>
      ))}
    </div>
  );
}
