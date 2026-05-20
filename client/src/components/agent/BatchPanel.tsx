
import React, { useEffect, useState } from 'react';
import DiffViewer from './DiffViewer';

export default function BatchPanel({ onClose, onApplyDone }) {
  const [patches, setPatches] = useState<any[]>([]);
  const [selected, setSelected] = useState<any|null>(null);
  const [batchId, setBatchId] = useState<string|null>(null);
  const [status, setStatus] = useState<any>(null);

  async function loadQueue(){
    try{
      const res = await fetch('/api/agent/queue'); // best-effort endpoint - may not exist
      if(!res.ok) return setPatches([]);
      const data = await res.json();
      setPatches(data.patches || data || []);
    }catch(e){ console.error(e); setPatches([]); }
  }

  useEffect(()=>{ void loadQueue(); }, []);

  async function applyAll(){
    const ids = patches.map(p=>p.id);
    const res = await fetch('/api/patches/batch/apply', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patchIds: ids })});
    const d = await res.json();
    if(d && d.batchId) {
      setBatchId(d.batchId);
      listenBatch(d.batchId);
    }
  }

  async function rejectAll(){
    const ids = patches.map(p=>p.id);
    const res = await fetch('/api/patches/batch/reject', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patchIds: ids })});
    const d = await res.json();
    if(d && d.batchId) {
      setBatchId(d.batchId);
      listenBatch(d.batchId);
    }
  }

  function listenBatch(bid){
    // subscribe to /sse/file?path=__batch__ events (batch-orchestrator emits here)
    const es = new EventSource(`/sse/file?path=__batch__`);
    es.onmessage = (ev)=>{
      try{
        const data = JSON.parse(ev.data||'{}');
        if(data && data.batchId === bid){
          setStatus(data);
          if(data.type === 'batch_done' || data.type === 'batch_reject_done' || data.type==='batch_failed'){
            es.close();
            onApplyDone && onApplyDone(data);
          }
        }
      }catch(e){ console.error("[BatchPanel] SSE parse error:", e); }
    };
  }

  return (
    <div style={{padding:12, color:'#ddd', width: '100%', maxHeight: 700, overflow:'auto'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>Batch Apply / Reject</h3>
        <div>
          <button onClick={loadQueue}>Refresh</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
      <div style={{display:'flex', gap:12}}>
        <div style={{width:360, maxHeight:520, overflow:'auto', border:'1px solid #222', padding:8}}>
          {patches.map(p=>(
            <div key={p.id} style={{padding:8, borderBottom:'1px solid #111', cursor:'pointer'}} onClick={()=>setSelected(p)}>
              <div style={{fontSize:12, color:'#aaa'}}>{p.time || p.appliedAt || ''}</div>
              <div style={{fontWeight:700}}>{p.title || p.summary || p.id}</div>
              <div style={{fontSize:12, color:'#ccc'}}>{p.author || p.user || ''}</div>
            </div>
          ))}
        </div>
        <div style={{flex:1}}>
          {selected ? (
            <>
              <div style={{marginBottom:8}}>
                <button onClick={()=>{ /* apply single */ }}>Apply this</button>
                <button onClick={()=>{ /* reject single */ }}>Reject this</button>
              </div>
              <div>
                <DiffViewer oldContent={selected.oldContent||''} newContent={selected.newContent||selected.previewContent||''} />
              </div>
            </>
          ) : <div style={{color:'#888'}}>Select a patch to preview</div>}
        </div>
      </div>
      <div style={{marginTop:12}}>
        <button onClick={applyAll}>Apply All</button>
        <button onClick={rejectAll} style={{marginLeft:8}}>Reject All</button>
      </div>
      <div style={{marginTop:12}}>
        <pre style={{whiteSpace:'pre-wrap', color:'#9aa'}}>{JSON.stringify(status,null,2)}</pre>
      </div>
    </div>
  );
}
