import React, { useState } from 'react';
export default function SolopilotModal({ onClose }:{ onClose?:()=>void }){
  const [intent,setIntent]=useState('');
  const [plan,setPlan]=useState<any|null>(null);
  const [result,setResult]=useState<any|null>(null);
  async function makePlan(){
    const res = await fetch('/api/solopilot/plan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ intent })});
    const d = await res.json();
    setPlan(d.plan || null);
  }
  async function executePlan(){
    const res = await fetch('/api/solopilot/execute', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ plan })});
    const d = await res.json();
    setResult(d.result || null);
  }
  return (<div style={{padding:12,color:'#ddd',width:'80%',height:'80%',overflow:'auto',background:'#021018'}}>
    <div style={{display:'flex',justifyContent:'space-between'}}><h3>Solopilot</h3><div><button onClick={()=>onClose && onClose()}>Close</button></div></div>
    <textarea value={intent} onChange={e=>setIntent(e.target.value)} style={{width:'100%',height:120,fontFamily:'monospace'}} placeholder='Describe high-level project goal'></textarea>
    <div style={{marginTop:8}}><button onClick={makePlan} disabled={!intent}>Create Plan</button> <button onClick={executePlan} disabled={!plan}>Execute Plan</button></div>
    <div style={{marginTop:12}}><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(plan,null,2)}</pre></div>
    <div style={{marginTop:12}}><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(result,null,2)}</pre></div>
  </div>); }