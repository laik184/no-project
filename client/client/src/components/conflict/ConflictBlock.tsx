import React, { useState } from 'react';

export default function ConflictBlock({ conflict, filePath }){
  const [suggestion, setSuggestion] = useState(null);
  async function askAI(){
    try{
      const res = await fetch('/api/solopilot/aiResolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ path: filePath, conflict })});
      const j = await res.json();
      if(j.ok) setSuggestion(j.suggestion && j.suggestion.suggestion ? j.suggestion.suggestion : j.suggestion);
      else alert('AI failed');
    }catch(e){ alert('Error: '+String(e)); }
  }
  return (
    <div style={{border:'1px solid #ddd',padding:8,marginBottom:8}}>
      <div style={{fontSize:12,color:'#333'}}>Conflict at line {conflict.index+1}</div>
      <div style={{display:'flex',marginTop:8}}>
        <div style={{flex:1,marginRight:8}}>
          <div style={{fontWeight:600}}>LOCAL</div>
          <pre style={{whiteSpace:'pre-wrap',background:'#fff',padding:8}}>{conflict.local}</pre>
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600}}>REMOTE</div>
          <pre style={{whiteSpace:'pre-wrap',background:'#fff',padding:8}}>{conflict.remote}</pre>
        </div>
      </div>
      <div style={{marginTop:8}}>
        <button onClick={askAI}>Ask AI to resolve</button>
        <button style={{marginLeft:8}} onClick={async ()=>{
          try{
            const res = await fetch('/api/solopilot/aiMerge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ path: filePath, conflict })});
            const j = await res.json();
            if(j.ok){ setSuggestion(j.merged); if(window && window.confirm){ if(window.confirm('Apply merged block to file?')){ const mergedContent = j.merged; const resp = await fetch('/api/solopilot/resolveConflictApply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ path: filePath, mergedContent })}); const rr = await resp.json(); if(rr.ok) alert('Merged applied'); else alert('Apply failed: '+(rr.error||'unknown')); } } } else alert('AI merge failed');
          }catch(e){ alert('Error: '+String(e)); }
        }}>AI Auto-Merge</button>
      </div>      <div style={{marginTop:8}}>
        <button onClick={askAI}>Ask AI to resolve</button>
      </div>
      {suggestion && <div style={{marginTop:8,background:'#f7f7f7',padding:8}}><strong>AI Suggestion:</strong><pre style={{whiteSpace:'pre-wrap'}}>{suggestion}</pre></div>}
    </div>
  );
}