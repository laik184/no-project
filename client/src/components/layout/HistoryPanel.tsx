
import React, { useEffect, useState } from 'react';
import DiffViewer from './DiffViewer';

export default function HistoryPanel({ filePath, onClose, onPreview }) {
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<any|null>(null);

  async function load() {
    if (!filePath) return setHistory([]);
    try {
      const res = await fetch(`/api/fs/history?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) return;
      const data = await res.json();
      setHistory(Array.isArray(data)?data:data.history||data);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(()=>{ void load(); }, [filePath]);

  return (
    <div style={{padding:12, width: '100%', color:'#ddd'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>History — {filePath}</h3>
        <div>
          <button onClick={load}>Refresh</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
      <div style={{display:'flex', gap:12}}>
        <div style={{width:320, maxHeight:400, overflow:'auto', border:'1px solid #222', padding:8}}>
          {history.map(h => (
            <div key={h.id || h.time} style={{padding:8, borderBottom:'1px solid #111', cursor:'pointer'}} onClick={()=>setSelected(h)}>
              <div style={{fontSize:12, color:'#aaa'}}>{new Date(h.time||h.created_at||h.timestamp||0).toLocaleString()}</div>
              <div style={{fontWeight:600}}>{h.author || h.user || h.author_id || 'unknown'}</div>
              <div style={{fontSize:12, color:'#ccc'}}>{h.message || h.description || h.reason || ''}</div>
            </div>
          ))}
        </div>
        <div style={{flex:1}}>
          {selected ? (
            <>
              <div style={{marginBottom:8}}><strong>Selected:</strong> {selected.id || selected.time}</div>
              <div style={{marginBottom:8}}><button onClick={async ()=>{
                // jump-to-version preview
                const res = await fetch(`/api/fs/commit?path=${encodeURIComponent(filePath)}&id=${encodeURIComponent(selected.id||selected.versionId||selected.serverVersionId||selected.commitId)}`);
                if (res.ok) {
                  const d = await res.json();
                  const content = d.content || d.newContent || d.serverContent || '';
                  onPreview && onPreview(content, selected);
                } else {
                  alert('Failed to load version content');
                }
              }}>Jump to version (preview)</button>
              <button onClick={async ()=>{
                if (confirm('Revert to this version? This will perform a server-side restore.')) {
                  const res = await fetch('/api/fs/rollback', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: filePath, versionId: selected.id || selected.versionId || selected.serverVersionId || selected.commitId })});
                  if (res.ok) { alert('Rollback requested'); load(); }
                }
              }}>Rollback to this</button></div>
              <div style={{marginBottom:8}}><strong>Metadata:</strong>
                <div>User: {selected.author || selected.user || selected.author_id}</div>
                <div>Message: {selected.message || selected.description || selected.reason}</div>
                <div>Time: {new Date(selected.time||selected.created_at||0).toLocaleString()}</div>
              </div>
              <div>
                <DiffViewer oldContent={selected.oldContent||selected.prevContent||selected.baseContent||''} newContent={selected.newContent||selected.content||selected.serverContent||''} />
              </div>
            </>
          ) : <div style={{color:'#888'}}>Select a history item to preview diff</div>}
        </div>
      </div>
    </div>
  );
}
