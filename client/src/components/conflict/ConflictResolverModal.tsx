
import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    __conflict_patch_path?: string;
  }
}

export default function ConflictResolverModal({ patchId, mergedPreview, conflicts, onClose }: { patchId:string|null, mergedPreview?:string, conflicts?:any[], onClose?:()=>void }) {
  const [content, setContent] = useState(mergedPreview||'');
  useEffect(()=>{ setContent(mergedPreview||''); }, [mergedPreview]);
  return (
    <div style={{padding:12, color:'#ddd', width:'90%', height:'90%', overflow:'auto', background:'#041020'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>Conflict Resolver — {patchId}</h3>
        <div><button onClick={()=>onClose && onClose()}>Close</button></div>
      </div>
      <div style={{marginTop:8, marginBottom:8}}>
        <div style={{fontSize:13, color:'#aaa'}}>Conflicts: {conflicts ? conflicts.length : 0}</div>
      </div>
      <textarea style={{width:'100%', height:'60%', fontFamily:'monospace', fontSize:13, background:'#001018', color:'#ddd'}} value={content} onChange={(e)=>setContent(e.target.value)} />
      <div style={{marginTop:8}}>
        <button onClick={async ()=>{
          // call resolve API - caller should provide path via patch metadata; for batch we rely on batch events to include path
          const path = window.__conflict_patch_path || '';
          const res = await fetch('/api/conflict/resolve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path, resolvedContent: content })});
          if(res.ok){ alert('Resolved and written'); onClose && onClose(); }
          else alert('Resolve failed');
        }}>Save Resolved</button>
      </div>
    </div>
  );
}
