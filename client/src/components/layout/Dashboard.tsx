
import React from 'react';

export default function Dashboard({ state }: any){
  return (
    <div style={{padding:16}}>
      <h2>AGI Dashboard</h2>
      <p>Status: {state?.step || 'idle'}</p>
      <button>Build</button>
      <button>Run</button>
      <button>Fix</button>
    </div>
  );
}
