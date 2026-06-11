/**
 * ActionCardRegistry — routes a tool name to its specific card component.
 *
 * Tool name normalization: underscore-style names (file_write) are
 * converted to dot-style (file.write) for routing, while both formats
 * are accepted via explicit alias lists.
 */
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import { FileOpenCard }    from "./FileOpenCard";
import { FileWriteCard }   from "./FileWriteCard";
import { TerminalCard }    from "./TerminalCard";
import { PackageCard }     from "./PackageCard";
import { ScreenshotCard }  from "./ScreenshotCard";
import { GitCard }         from "./GitCard";
import { DeployCard }      from "./DeployCard";
import { DatabaseCard }    from "./DatabaseCard";

/** Normalize underscore_tool to dot.tool */
export function normalizeTool(tool: string): string {
  return tool.replace(/_/g, ".");
}

const FILE_OPEN = new Set([
  "file.read", "file.list", "file.search", "file.create",
  "file_read", "file_list", "file_search", "file_create",
  "fs.read.file", "fs.find.by.pattern", "fs.search.text", "fs.scan.folder",
  "preview.open",
]);
const FILE_WRITE = new Set([
  "file.write", "file.replace", "file_write", "file_replace",
  "fs.write.file", "fs.write.if.absent", "fs.ensure.file", "fs.append.file",
  "patch.queue", "diff.queued",
]);
const TERMINAL = new Set([
  "shell.exec", "shell_exec", "console.run",
  "terminal.execute.command", "terminal.stream.command", "terminal.npm.run.script",
  "terminal.npm.build", "terminal.npm.test", "terminal.npm.ci",
  "run.build", "run.tests", "run.typecheck", "run.lint",
]);
const PACKAGE = new Set([
  "package.install", "package.remove", "package.audit",
  "package_install", "package_uninstall", "package_audit",
  "terminal.install.package", "terminal.uninstall.package", "terminal.update.package",
  "detect_missing_packages", "detect.missing.packages",
]);
const SCREENSHOT = new Set([
  "screenshot.capture", "preview_screenshot", "preview.screenshot",
  "browser.screenshot", "browser.element.screenshot",
  "ui.render",
]);
const DATABASE = new Set([
  "db.push", "db.migrate", "db_push", "db_migrate",
]);
const DEPLOY = new Set([
  "deploy.publish", "deploy_publish",
  "server.start", "server.restart", "terminal.start.runtime", "terminal.restart.runtime",
]);

/**
 * Returns a React element for the given tool, or null if unmapped.
 * Callers should render ToolGroupLine as the fallback when null is returned.
 */
export function renderActionCard(
  tool: string,
  item: AgentStreamItem,
  onOpenFile?: (path: string) => void,
): React.ReactNode | null {
  if (FILE_OPEN.has(tool))    return <FileOpenCard   item={item} onOpenFile={onOpenFile} />;
  if (FILE_WRITE.has(tool))   return <FileWriteCard  item={item} onOpenFile={onOpenFile} />;
  if (TERMINAL.has(tool))     return <TerminalCard   item={item} />;
  if (PACKAGE.has(tool))      return <PackageCard    item={item} />;
  if (SCREENSHOT.has(tool))   return <ScreenshotCard item={item} />;
  if (DATABASE.has(tool))     return <DatabaseCard   item={item} />;
  if (DEPLOY.has(tool))       return <DeployCard     item={item} />;

  const norm = normalizeTool(tool);
  if (FILE_OPEN.has(norm))    return <FileOpenCard   item={item} onOpenFile={onOpenFile} />;
  if (FILE_WRITE.has(norm))   return <FileWriteCard  item={item} onOpenFile={onOpenFile} />;
  if (TERMINAL.has(norm))     return <TerminalCard   item={item} />;
  if (PACKAGE.has(norm))      return <PackageCard    item={item} />;
  if (SCREENSHOT.has(norm))   return <ScreenshotCard item={item} />;
  if (DATABASE.has(norm))     return <DatabaseCard   item={item} />;
  if (DEPLOY.has(norm))       return <DeployCard     item={item} />;

  if (norm.startsWith("git.") || tool.startsWith("git_")) return <GitCard item={item} />;
  if (norm.startsWith("package."))  return <PackageCard    item={item} />;
  if (norm.startsWith("deploy."))   return <DeployCard     item={item} />;
  if (norm.startsWith("db."))       return <DatabaseCard   item={item} />;
  if (norm.startsWith("screenshot.")) return <ScreenshotCard item={item} />;

  return null;
}
