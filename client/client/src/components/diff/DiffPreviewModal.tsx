import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import React from 'react';
import DiffViewer from 'react-diff-viewer-continued'; // lightweight, may need install

function computeHunks(oldStr, newStr){
  const oldLines = oldStr.split(/\r?\n/);
  const newLines = newStr.split(/\r?\n/);
  const hunks = [];
  // simple diff: sliding window - find first differing line and group contiguous differences
  let i=0, j=0;
  while(i<oldLines.length || j<newLines.length){
    if(oldLines[i] === newLines[j]){ i++; j++; continue; }
    // start a hunk at i
    const startOld = i;
    const oldChunk = [];
    const newChunk = [];
    while((i<oldLines.length && oldLines[i] !== newLines[j]) || (j<newLines.length && oldLines[i] !== newLines[j])){
      if(i<oldLines.length && (j>=newLines.length || oldLines[i] !== newLines[j])){ oldChunk.push(oldLines[i]); i++; } 
      if(j<newLines.length && (i>=oldLines.length || oldLines[i] !== newLines[j])){ newChunk.push(newLines[j]); j++; }
      if(i>=oldLines.length && j>=newLines.length) break;
    }
    hunks.push({ startLineOld: startOld, oldLines: oldChunk.length, newText: newChunk.join('\n'), oldChunk, newChunk });
  }
  return hunks;
}

// Myers diff algorithm (simple) to compute hunks
function myersDiff(aLines, bLines){
  // simple implementation using dynamic programming for LCS to find diffs
  const n = aLines.length, m = bLines.length;
  const dp = Array.from({length:n+1}, ()=>Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--){
    for(let j=m-1;j>=0;j--){
      if(aLines[i]===bLines[j]) dp[i][j]=dp[i+1][j+1]+1;
      else dp[i][j]=Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  const hunks = [];
  let i=0,j=0;
  while(i<n || j<m){
    if(i<n && j<m && aLines[i]===bLines[j]){ i++; j++; continue; }
    const startOld = i;
    const oldChunk = [];
    const newChunk = [];
    while((i<n && (j>=m || aLines[i]!==bLines[j])) || (j<m && (i>=n || aLines[i]!==bLines[j]))){
      if(i<n && (j>=m || aLines[i]!==bLines[j])){ oldChunk.push(aLines[i]); i++; }
      if(j<m && (i>=n || aLines[i]!==bLines[j])){ newChunk.push(bLines[j]); j++; }
      if(i>=n && j>=m) break;
    }
    hunks.push({ startLineOld: startOld, oldLines: oldChunk.length, newText: newChunk.join('\\n'), oldChunk, newChunk });
  }
  return hunks;
}
export default function DiffPreviewModal({ patch, onClose, onApply, onReject }){
  if(!patch) return null;
  const oldStr = patch.oldContent || '';
  const newStr = patch.newContent || '';
  return (
    <div style={{position:'fixed',left:50,top:50,right:50,bottom:50,background:'#fff',zIndex:9999,boxShadow:'0 10px 40px rgba(0,0,0,0.5)',padding:16,overflow:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{margin:0}}>{patch.path} — {patch.id}</h3>
        <div>
          <button onClick={()=>{ onApply && onApply(patch); }} style={{marginRight:8}}>Apply Patch</button>
          <button onClick={()=>{ onReject && onReject(patch); }} style={{marginRight:8}}>Reject Patch</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
      <div style={{marginTop:12}}>
        <DiffViewer oldValue={oldStr} newValue={newStr} splitView={true} />
      </div>
    </div>
  );
}