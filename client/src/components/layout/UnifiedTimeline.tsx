
import React, { useEffect, useState } from 'react';
import DiffViewer from './DiffViewer';

function formatTime(t:any){ try{ return new Date(t).toLocaleString(); }catch{ return String(t); } }

export default function UnifiedTimeline({ filePath, onClose, onPreview }: { filePath?: string|null, onClose?: ()=>void, onPreview?: (content:string,meta:any)=>void }) {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any|null>(null);

  async function load() {
    if (!filePath) return setItems([]);
    try {
      const res = await fetch(`/api/fs/timeline?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data)?data:[]);
    } catch (e) { console.error(e); }
  }

  useEffect(()=>{ void load(); }, [filePath]);

  return (
    <div style={{padding:12, width:'100%', color:'#ddd'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>Unified Timeline — {filePath}</h3>
        <div>
          <button onClick={load}>Refresh</button>
          <button onClick={()=>onClose && onClose()}>Close</button>
        </div>
      </div>
      <div style={{display:'flex', gap:12}}>
        <div style={{width:360, maxHeight:560, overflow:'auto', border:'1px solid #222', padding:8}}>
          {items.map(it => (
            <div key={it.id || it.time + (it.type||'')} style={{padding:8, borderBottom:'1px solid #111', cursor:'pointer'}} onClick={()=>setSelected(it)}>
              <div style={{fontSize:12, color:'#aaa'}}>{formatTime(it.time)}</div>
              <div style={{fontWeight:700}}>{it.type === 'ai_patch' ? 'AI Patch' : it.type === 'commit' ? 'Commit' : it.type}</div>
              <div style={{fontSize:12, color:'#ccc'}}>{it.author || it.user || it.author_id || it.message || it.description || ''}</div>
            </div>
          ))}
        </div>
        <div style={{flex:1}}>
          {selected ? (
            <>
              <div style={{marginBottom:8}}><strong>Selected:</strong> {selected.id || selected.time}</div>
              <div style={{marginBottom:8}}>
                <button onClick={async ()=>{
                  // preview content (commit) or fetch patch content
                  if (selected.type === 'commit') {
                    const res = await fetch(`/api/fs/commit?path=${encodeURIComponent(filePath||'')}&id=${encodeURIComponent(selected.id||selected.versionId||selected.serverVersionId||selected.commitId||'')}`);
                    if (res.ok) {
                      const d = await res.json();
                      const content = d.content || d.newContent || d.serverContent || '';
                      onPreview && onPreview(content, selected);
                    } else alert('failed');
                  } else if (selected.type === 'ai_patch') {
                    // attempt to fetch patch preview endpoint
                    const res = await fetch(`/api/patches/${encodeURIComponent(selected.id)}/preview`);
                    if (res.ok) {
                      const d = await res.json();
                      const content = d.previewContent || d.newContent || '';
                      onPreview && onPreview(content, selected);
                    } else alert('not available');
                  }
                }}>Jump to version (preview)</button>
                <button onClick={async ()=>{
                  if (!confirm('Rollback to this point?')) return;
                  if (selected.type === 'commit') {
                    await fetch('/api/fs/rollback', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: filePath, versionId: selected.id || selected.versionId })});
                    alert('Rollback requested');
                    load();
                  } else if (selected.type === 'ai_patch') {
                    // for ai_patch, might call /api/patches/:id/reject or create rollback logic
                    await fetch('/api/patches/' + encodeURIComponent(selected.id) + '/apply', {method:'POST'});
                    alert('Applied patch request sent');
                    load();
                  }
                }}>Apply / Rollback</button>
              </div>
              <div style={{marginBottom:8}}><strong>Metadata:</strong>
                <div>Source: {selected.source || selected.type}</div>
                <div>User: {selected.author || selected.user || selected.author_id}</div>
                <div>Message: {selected.message || selected.description || selected.reason}</div>
                <div>Time: {formatTime(selected.time)}</div>
              </div>
              <div>
                <DiffViewer oldContent={selected.oldContent||selected.prevContent||selected.baseContent||''} newContent={selected.newContent||selected.content||selected.serverContent||''} />
              </div>
            </>
          ) : <div style={{color:'#888'}}>Select a timeline item to preview diff</div>}
        </div>
      </div>
    </div>
  );
}
