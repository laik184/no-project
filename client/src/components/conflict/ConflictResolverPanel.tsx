import React, { useState } from 'react';
import ConflictBlock from './ConflictBlock';

export default function ConflictResolverPanel(){
  const [filePath, setFilePath] = useState('');
  const [merged, setMerged] = useState('');
  const [conflicts, setConflicts] = useState([]);

  async function prepare(){
    try{
      const res = await fetch('/api/solopilot/prepareConflict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ path: filePath })});
      const j = await res.json();
      if(j.ok){ setMerged(j.merged); setConflicts(j.conflicts || []); } else alert('Prepare failed');
    }catch(e){ alert('Error: '+String(e)); }
  }

  return (
    <div style={{padding:12}}>
      <h3>Conflict Resolver</h3>
      <div>
        <input placeholder="Relative path (e.g. src/App.tsx)" value={filePath} onChange={e=>setFilePath(e.target.value)} style={{width:'60%'}} />
        <button onClick={prepare} style={{marginLeft:8}}>Prepare</button>
      </div>
      <div style={{marginTop:12}}>
        {conflicts.length===0 && <div>No conflicts detected</div>}
        {conflicts.map((c,idx)=> <ConflictBlock key={idx} conflict={c} filePath={filePath} />)}
      </div>
      <div style={{marginTop:12}}>
        <h4>Merged Preview</h4>
        <pre style={{whiteSpace:'pre-wrap', background:'#fafafa', padding:8}}>{merged}</pre>
        <div style={{marginTop:8}}>
          <button onClick={async ()=>{ 
            const mergedContent = merged;
            try{ const res = await fetch('/api/solopilot/resolveConflictApply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ path: filePath, mergedContent })}); const j=await res.json(); if(j.ok) alert('Applied merged file'); else alert('Apply failed'); }catch(e){ alert(String(e)); }
          }}>Apply Merged</button>
        </div>
      </div>
    </div>
  );
}