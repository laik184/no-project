import React from 'react';
export default function PatchList({ patches, selectedId, onSelect }){
  return (
    <div style={{width:320,borderRight:'1px solid #eee',padding:8,overflow:'auto'}}>
      <h4>Patches</h4>
      {(!patches || patches.length===0) && <div>No patches</div>}
      <ul style={{listStyle:'none',padding:0}}>
        {patches && patches.map(p=>(
          <li key={p.id} style={{marginBottom:8,background: p.id===selectedId? '#f0f8ff':'transparent',padding:6,borderRadius:4,cursor:'pointer'}} onClick={()=>onSelect(p)}>
            <div style={{fontSize:12,color:'#333'}}>{p.path}</div>
            <div style={{fontSize:11,color:'#666'}}>{p.id} • {p.status || 'generated'}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}