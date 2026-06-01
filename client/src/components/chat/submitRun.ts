/**
 * submitRun — pure async function that POSTs a new run to the API.
 * Returns the runId on success, throws on failure.
 */
export async function submitRun(
  projectId: number,
  goal:      string,
  mode:      string,
): Promise<string> {
  const r = await fetch("/api/run", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-project-id": String(projectId) },
    body:    JSON.stringify({ projectId, goal, mode }),
  });
  const j = await r.json();
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  const runId = j.data?.runId || j.data?.id;
  if (!runId) throw new Error("server did not return runId");
  return runId;
}
