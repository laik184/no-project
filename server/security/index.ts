/**
 * server/security/index.ts
 *
 * Security router — exposes security scan endpoints for agent runs.
 * Integrates with the infrastructure security scanner.
 */

import { Router, type Request, type Response } from 'express';

interface ScanResult {
  runId:     string;
  scannedAt: Date;
  issues:    SecurityIssue[];
  passed:    boolean;
}

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  rule:     string;
  file?:    string;
  line?:    number;
  message:  string;
}

const scanCache = new Map<string, ScanResult>();

async function scanPath(targetPath: string, runId: string): Promise<ScanResult> {
  const issues: SecurityIssue[] = [];

  try {
    const { readdir } = await import('fs/promises');
    const { readFileSync } = await import('fs');
    const path = await import('path');

    const scanFile = (filePath: string): void => {
      try {
        const content = readFileSync(filePath, 'utf8');
        if (/process\.env\.[A-Z_]+\s*=/.test(content)) {
          issues.push({
            severity: 'high',
            rule:     'env-mutation',
            file:     filePath,
            message:  'Direct process.env mutation detected',
          });
        }
        if (/eval\s*\(/.test(content)) {
          issues.push({
            severity: 'critical',
            rule:     'no-eval',
            file:     filePath,
            message:  'Use of eval() detected',
          });
        }
        const secretPattern = /(?:password|secret|api_key|apikey|token)\s*=\s*['"][^'"]{8,}['"]/i;
        if (secretPattern.test(content)) {
          issues.push({
            severity: 'critical',
            rule:     'hardcoded-secret',
            file:     filePath,
            message:  'Potential hardcoded secret detected',
          });
        }
      } catch {
        // skip unreadable files
      }
    };

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) await walk(full);
          else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) scanFile(full);
        }
      } catch {
        // skip unreadable dirs
      }
    };

    await walk(targetPath);
  } catch {
    // scanning is best-effort
  }

  const result: ScanResult = {
    runId,
    scannedAt: new Date(),
    issues,
    passed: issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length === 0,
  };

  scanCache.set(runId, result);
  return result;
}

export function createSecurityRouter(): Router {
  const router = Router();

  router.post('/scan/:runId', async (req: Request, res: Response) => {
    const { runId } = req.params;
    const { path: targetPath = process.env.AGENT_PROJECT_ROOT || '.sandbox' } = req.body as { path?: string };

    try {
      const result = await scanPath(targetPath, runId);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  router.get('/scan/:runId', (req: Request, res: Response) => {
    const result = scanCache.get(req.params.runId);
    if (!result) {
      res.status(404).json({ ok: false, error: 'No scan found for this runId' });
      return;
    }
    res.json({ ok: true, ...result });
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, scanner: 'active', cached: scanCache.size });
  });

  return router;
}
