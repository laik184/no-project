import { TSConfigResolver }    from './tsconfig-resolver.ts';
import { ImportGraphValidator } from './import-graph-validator.ts';

export interface TypeScriptVerificationResult {
  ok:         boolean;
  hasConfig:  boolean;
  issues:     unknown[];
  error?:     string;
}

export async function verifyTypeScript(workspacePath: string): Promise<TypeScriptVerificationResult> {
  try {
    const resolver  = new TSConfigResolver(workspacePath);
    const validator = new ImportGraphValidator(workspacePath);
    const config    = resolver.resolve();
    const graph     = await validator.validate();
    return { ok: graph.ok, hasConfig: !!config, issues: graph.issues };
  } catch (err) {
    return { ok: false, hasConfig: false, issues: [], error: String(err) };
  }
}

export { TSConfigResolver, ImportGraphValidator };
