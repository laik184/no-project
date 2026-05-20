export interface DeploymentInput {
  projectId: number;
  region?: string;
  [key: string]: unknown;
}

export interface DeploymentRecord {
  id: string;
  projectId: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: number;
  logs: string[];
  error?: string;
}

const _deployments = new Map<string, DeploymentRecord>();

export async function startDeployment(input: DeploymentInput): Promise<DeploymentRecord> {
  const id = crypto.randomUUID();
  const record: DeploymentRecord = {
    id,
    projectId: input.projectId,
    status: 'pending',
    createdAt: Date.now(),
    logs: ['Deployment queued'],
  };
  _deployments.set(id, record);
  return record;
}

export async function getDeployment(deploymentId: string): Promise<DeploymentRecord | null> {
  return _deployments.get(deploymentId) ?? null;
}

export async function listDeployments(projectId: number): Promise<DeploymentRecord[]> {
  return [..._deployments.values()].filter(d => d.projectId === projectId);
}
