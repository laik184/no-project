
const API="/api/agent";

export async function createRun(idea:string){
  const r=await fetch(API+"/run/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idea})});
  return r.json();
}
export async function startRun(id:string){
  return fetch(API+"/run/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
}
export async function pauseRun(id:string){
  return fetch(API+"/run/pause",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
}
export async function resumeRun(id:string){
  return fetch(API+"/run/resume",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
}
export async function hardStopRun(id:string){
  return fetch(API+"/run/hard-stop",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
}


// ===============================
// ✅ STEP 6B: Versioning & Safety APIs
// ===============================

const FILE_API = "/api";

export async function getFileHistory(projectId: string, filePath: string) {
  const res = await fetch(
    `${FILE_API}/file/history?projectId=${encodeURIComponent(projectId)}&filePath=${encodeURIComponent(filePath)}`
  );
  return res.json();
}

export async function undoFile(projectId: string, filePath: string) {
  const res = await fetch(`${FILE_API}/file/undo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, filePath }),
  });
  return res.json();
}

export async function checkConflict(
  projectId: string,
  filePath: string,
  baseVersionId: string | null
) {
  const res = await fetch(`${FILE_API}/file/conflict-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, filePath, baseVersionId }),
  });
  return res.json();
}
