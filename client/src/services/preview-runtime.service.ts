export const PreviewRuntimeService = {
  async runProject(id: string, projectPath: string) {
    const res = await fetch("/api/run-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, projectPath })
    });
    if (!res.ok) throw new Error("Run failed");
    return true;
  },

  async stopProject(id: string) {
    const res = await fetch("/api/stop-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error("Stop failed");
    return true;
  },

  async getStatus() {
    const res = await fetch("/api/project-status");
    return res.json();
  },

  async getTunnelInfo() {
    const res = await fetch("/api/tunnel-info");
    return res.json();
  },

  async restartProject(id: string, projectPath: string) {
    await this.stopProject(id);
    await this.runProject(id, projectPath);
  }
};