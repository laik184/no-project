import React from 'react';
export default function LogsList({ events }){
  return (<div style={{height:300,overflow:'auto',border:'1px solid #eee',padding:8}}>{events.map((e,idx)=>(<div key={idx} style={{padding:6,borderBottom:'1px solid #f0f0f0'}}><div style={{fontSize:11,color:'#666'}}>{new Date(e.ts).toLocaleString()}</div><div><pre style={{whiteSpace:'pre-wrap',margin:0}}>{JSON.stringify(e.payload,null,2)}</pre></div></div>))}</div>);
}