// PatchDiffModal placeholder
import React from 'react';
export default function PatchDiffModal({diff,onClose}){
  return (
    <div style={{position:'fixed',top:50,left:50,background:'#112233',padding:16,color:'#fff'}}>
      <h4>Diff Preview</h4>
      <pre>{diff}</pre>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
