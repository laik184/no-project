import React, { useState } from 'react';

export default function WebPanel(){
  const [name,setName] = useState('Products');
  const [type,setType] = useState('list');
  const [logs,setLogs] = useState([]);

  async function genPage(){
    const r = await fetch('/api/web/generate/page', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, type }) });
    const j = await r.json();
    alert('Page generated: '+ (j.ok? 'ok':'fail'));
  }

  async function genFull(){
    const intent = prompt('Enter intent for full web app (e.g. "ecommerce app with products list and checkout")');
    if(!intent) return;
    const r = await fetch('/api/web/generate/fullapp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ intent }) });
    const j = await r.json();
    alert('Full web app generation: '+ JSON.stringify(j));
  }

  return (<div style={{padding:12,border:'1px solid #eee', marginTop:12}}>
    <h4>Web Builder</h4>
    <div style={{display:'flex',gap:8,marginBottom:8}}>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Page name" />
      <select value={type} onChange={e=>setType(e.target.value)}>
        <option value="home">Home</option>
        <option value="list">List</option>
        <option value="detail">Detail</option>
        <option value="login">Login</option>
      </select>
      <button onClick={genPage}>Generate Page</button>
      <button onClick={genFull}>Generate Full Web App</button>
    </div>
  </div>);
}