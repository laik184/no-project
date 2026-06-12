#!/usr/bin/env node
/**
 * scripts/governance-check.mjs
 *
 * Static architecture governance gate for the autonomous platform.
 * This intentionally has no TypeScript runtime dependency so it can run even
 * when the app is broken. It verifies the same core layering rules documented
 * in eslint.config.mjs and also validates that package scripts do not point at
 * missing local files.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function walk(relativeDir, result = []) {
  const absDir = join(root, relativeDir);
  if (!existsSync(absDir)) return result;

  for (const entry of readdirSync(absDir)) {
    const rel = join(relativeDir, entry);
    if (
      rel.includes(`${join('node_modules')}`) ||
      rel.includes(`${join('dist')}`) ||
      rel.includes(`${join('.git')}`) ||
      rel.includes(`${join('server', '.local')}`)
    ) continue;

    const stat = statSync(join(root, rel));
    if (stat.isDirectory()) walk(rel, result);
    else if (/\.(ts|tsx|mts|cts)$/.test(rel)) result.push(normalize(rel));
  }

  return result;
}

function extractModuleSpecifiers(source) {
  const specs = [];
  const importExport = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImport = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = importExport.exec(source))) specs.push(match[1]);
  while ((match = dynamicImport.exec(source))) specs.push(match[1]);
  return specs;
}

function resolveLocalImport(fromFile, specifier) {
  if (specifier.startsWith('@/')) return normalize(join('client/src', specifier.slice(2)));
  if (specifier.startsWith('@shared/')) return normalize(join('shared', specifier.slice('@shared/'.length)));
  if (specifier === '@services/chat') return normalize('server/services/chat/index.ts');
  if (specifier.startsWith('@services/chat/')) return normalize(join('server/services/chat', specifier.slice('@services/chat/'.length)));
  if (specifier === '@services/filesystem') return normalize('server/services/filesystem/index.ts');
  if (specifier.startsWith('@services/filesystem/')) return normalize(join('server/services/filesystem', specifier.slice('@services/filesystem/'.length)));
  if (!specifier.startsWith('.')) return null;
  return normalize(join(dirname(fromFile), specifier));
}

function violates(prefixes, resolved) {
  return prefixes.some((prefix) => resolved === prefix || resolved.startsWith(`${prefix}/`));
}

function checkLayerRules(files) {
  const rules = [
    {
      scope: 'server/tools/',
      forbidden: ['server/agents', 'server/orchestration', 'server/chat'],
      message: 'Tools must not import agents, orchestration, or chat.',
    },
    {
      scope: 'server/agents/',
      forbidden: ['server/chat', 'server/orchestration'],
      message: 'Agents must not import chat or orchestration.',
    },
    {
      scope: 'server/orchestration/',
      forbidden: ['server/chat'],
      message: 'Orchestration must not import chat.',
    },
    {
      scope: 'server/infrastructure/',
      forbidden: ['server/agents', 'server/tools', 'server/orchestration', 'server/chat', 'server/memory'],
      message: 'Infrastructure must not import domain layers.',
    },
    {
      scope: 'server/memory/',
      forbidden: ['server/agents', 'server/tools', 'server/orchestration', 'server/chat'],
      message: 'Memory must not import agents, tools, orchestration, or chat.',
    },
  ];

  for (const file of files) {
    const activeRules = rules.filter((rule) => file.startsWith(rule.scope));
    if (activeRules.length === 0) continue;

    const source = readFileSync(join(root, file), 'utf8');
    for (const specifier of extractModuleSpecifiers(source)) {
      const resolved = resolveLocalImport(file, specifier);
      if (!resolved) continue;
      for (const rule of activeRules) {
        if (violates(rule.forbidden, resolved)) {
          fail(`${file} imports ${specifier} (${resolved}): ${rule.message}`);
        }
      }
    }
  }
}

function checkPackageScripts() {
  const pkg = readJson('package.json');
  const scripts = pkg.scripts ?? {};
  for (const [name, command] of Object.entries(scripts)) {
    const localScriptRefs = [...String(command).matchAll(/(?:node|tsx|ts-node)\s+([^\s;&|]+\.(?:mjs|cjs|js|ts))/g)];
    for (const match of localScriptRefs) {
      const scriptPath = match[1];
      if (scriptPath.startsWith('-')) continue;
      if (!existsSync(join(root, scriptPath))) {
        fail(`package.json script "${name}" references missing file: ${scriptPath}`);
      }
    }
  }
}

const sourceFiles = [
  ...walk('server'),
  ...walk('client/src'),
  ...walk('shared'),
  ...walk('scripts'),
  'main.ts',
].filter((file, index, arr) => arr.indexOf(file) === index && existsSync(join(root, file)));

checkLayerRules(sourceFiles);
checkPackageScripts();

if (failures.length > 0) {
  console.error('Governance check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Governance check passed (${sourceFiles.length} source files scanned).`);
