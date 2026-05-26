
export function mapPipelineResponse(res: any) {
  return {
    plan: res.plan,
    tasks: res.tasks ?? [],
  };
}
