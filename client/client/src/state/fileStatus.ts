
export type Status = {
  dirty?: boolean;
  conflict?: boolean;
  aiPending?: boolean;
  timeline?: boolean;
  synced?: boolean;
};

const statuses: Record<string, Status> = {};
const listeners: ((path:string,s:Status)=>void)[] = [];

export function getStatus(path: string): Status {
  return statuses[path] || { synced: true };
}

export function setStatus(path: string, patch: Partial<Status>) {
  const next = Object.assign({}, getStatus(path), patch);
  statuses[path] = next;
  listeners.forEach(l=>l(path,next));
}

export function subscribeAll(cb:(path:string,s:Status)=>void){
  listeners.push(cb);
  return ()=>{ const i=listeners.indexOf(cb); if(i>=0) listeners.splice(i,1); };
}
