#!/usr/bin/env node
/**
 * Tool pipeline source/reality audit with no TypeScript runtime dependency.
 *
 * Verifies the known execution-break classes that caused fake success:
 * - dispatcher performs filesystem reality checks after reported write/delete success
 * - terminal npm install passes packageName/packages correctly
 * - terminal file step types route to real fs_* tools instead of falling through
 * - verifier unsupported virtual steps fail instead of reporting delegated success
 * - verifier missing sandbox fails instead of succeeding as a no-op
 *
 * It also performs small direct Node side-effect checks so CI catches an
 * environment that cannot create files, execute commands, or manage a process.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync, spawn } from 'child_process';
import { tmpdir } from 'os';

const failures = [];
const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertContains(path, text, message) {
  assert(read(path).includes(text), message);
}

function assertNotContains(path, text, message) {
  assert(!read(path).includes(text), message);
}

const dispatcher = 'server/tools/registry/tool-dispatcher.ts';
assertContains(dispatcher, 'assertRealityForFilesystemOutput', 'Dispatcher must enforce filesystem reality checks.');
assertContains(dispatcher, 'reported success but file does not exist on disk', 'Dispatcher must reject fake filesystem write success.');
assertContains(dispatcher, 'reported success but file still exists on disk', 'Dispatcher must reject fake filesystem delete success.');


const filesystemCoordinator = 'server/agents/filesystem/coordination/tool-coordinator.ts';
for (const tool of ['fs_read_file', 'fs_read_lines', 'fs_write_file', 'fs_append_file', 'fs_write_if_absent', 'fs_patch_file', 'fs_patch_all', 'fs_delete_file', 'fs_delete_folder', 'fs_delete_multiple']) {
  assertContains(filesystemCoordinator, tool, `Filesystem coordinator must route to registered ${tool}.`);
}
assertNotContains(filesystemCoordinator, "toolName: 'write_file'", 'Filesystem coordinator must not route to unregistered write_file.');
assertNotContains(filesystemCoordinator, "toolName:  'read_file'", 'Filesystem coordinator must not route to unregistered read_file.');
assertNotContains(filesystemCoordinator, 'joinPaths(sandboxRoot', 'Filesystem coordinator must pass relative paths; tools resolve against ctx.sandboxRoot.');
assertContains(dispatcher, 'reported success but folder does not exist on disk', 'Dispatcher must reject fake folder create success.');
assertContains('server/infrastructure/runtime/runtime-manager.ts', 'exited before becoming observable', 'Runtime manager must not report success before a spawned process survives startup.');
assertContains('server/preview/api/runtime-routes.ts', 'packageManagerRunCommand', 'Preview runtime command detection must honor the workspace package manager.');

const terminalStepRunner = 'server/agents/terminal/execution/step-runner.ts';
for (const step of ['write_file', 'read_file', 'patch_file', 'delete_file', 'list_directory', 'search_files']) {
  assertContains(terminalStepRunner, `case '${step}'`, `Terminal step runner must route ${step}.`);
}
assertContains(terminalStepRunner, 'packageName, packages: pkgs', 'Terminal npm install must pass packageName/packages to the package tool.');
assertContains('server/agents/terminal/coordination/tool-coordinator.ts', 'packages,', 'Terminal coordinator must pass the full package list, not silently install only the first package.');
assertContains(terminalStepRunner, 'checkpoint has no registered persistence-backed tool', 'Terminal checkpoint must not report fake success.');
assertContains(terminalStepRunner, 'validate_output has no registered tool-backed side effect', 'Terminal validate_output must not report fake success.');

const terminalRouting = 'server/agents/terminal/coordination/execution-routing.ts';
assertContains(terminalRouting, 'packageName, packages: pkgs', 'Terminal routing npm install must pass packageName/packages to the package tool.');
assertNotContains(terminalRouting, 'Checkpoint recorded', 'Terminal routing must not report checkpoint fake success.');
assertNotContains(terminalRouting, 'Validated:', 'Terminal routing must not report validate_output fake success.');

const verifierStepRunner = 'server/agents/verifier/execution/step-runner.ts';
assertContains(verifierStepRunner, 'VERIFIER_TOOLS.DETECT_ROOT_CAUSES', 'Verifier must dispatch detect_root_causes to its registered tool.');
assertContains(verifierStepRunner, 'cannot report success', 'Verifier unsupported virtual steps must fail instead of reporting success.');
assertNotContains(verifierStepRunner, 'delegated', 'Verifier step runner must not emit delegated fake success.');

const verifierRouting = 'server/agents/verifier/coordination/verification-routing.ts';
assertContains(verifierRouting, 'VERIFIER_TOOLS.DETECT_ROOT_CAUSES', 'Verifier routing must dispatch detect_root_causes to its registered tool.');
assertNotContains(verifierRouting, 'delegated', 'Verifier routing must not emit delegated fake success.');

const verifierAgent = 'server/agents/verifier/verifier-agent.ts';
assertContains(verifierAgent, 'return failedOutput(runId, phases, 0, [error]);', 'Verifier missing sandbox must fail explicitly.');
assertNotContains(verifierAgent, 'skipping verification (non-fatal)', 'Verifier missing sandbox must not be a success no-op.');

const installTool = 'server/tools/terminal/package-manager/install-package-tool.ts';
assertContains(installTool, 'singlePackage ? [singlePackage, ...packageList', 'Package install tool must install packageName plus the full packages array.');
assertContains(installTool, 'physical verification failed', 'Package install tool must reject success without physical verification.');
assertContains(installTool, 'packageJsonUpdated', 'Package install tool must validate package.json side effects.');
assertContains(installTool, 'lockfileUpdated', 'Package install tool must validate lockfile side effects.');
assertContains(installTool, 'nodeModulesPresent', 'Package install tool must validate node_modules side effects.');
assertContains(installTool, 'requires packageName or a non-empty packages array', 'Package install tool must reject empty package requests.');

const packageInstaller = 'server/services/terminal/package-manager/package-installer-service.ts';
assertContains(packageInstaller, 'getInstallCmd(manager, packages', 'Package installer must execute one package-manager command for all requested packages.');
assertContains(packageInstaller, 'No package.json found', 'Package installer must fail before execution when cwd is not a package workspace.');
assertContains(packageInstaller, 'result.error ? `', 'Package installer output must include spawn failures.');
assertContains(packageInstaller, '${result.error.message}', 'Package installer output must include spawn failure messages.');

// Direct side-effect checks for the execution environment itself.
const temp = mkdtempSync(join(tmpdir(), 'nurax-tool-audit-'));
try {
  const file = join(temp, 'created.txt');
  writeFileSync(file, 'real file side effect\n');
  assert(existsSync(file), 'Direct file side-effect check failed.');

  const command = spawnSync(process.execPath, ['-e', 'process.stdout.write("real command side effect")'], { encoding: 'utf8' });
  assert(command.status === 0 && command.stdout === 'real command side effect', 'Direct command side-effect check failed.');

  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(child.pid && !child.killed, 'Direct runtime side-effect check failed to start a process.');
  child.kill('SIGTERM');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('Tool pipeline audit failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Tool pipeline source/reality audit passed.');
