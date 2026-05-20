import type { InstallOperation, InstallOptions, PackageManager } from "../types.js";

export interface CommandSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly printable: string;
}

export function buildPackageCommand(
  manager: PackageManager,
  operation: InstallOperation,
  packages: readonly string[],
  options: Readonly<InstallOptions>,
): Readonly<CommandSpec> {
  const args: string[] = [];

  if (operation === "install") {
    if (manager === "yarn") args.push("add");
    else args.push("install");
  }

  if (operation === "update") {
    if (manager === "yarn") args.push("upgrade");
    else args.push("update");
  }

  if (operation === "remove") {
    args.push("remove");
  }

  if (options.isDev) {
    if (manager === "yarn") args.push("--dev");
    else args.push("--save-dev");
  }

  if (options.exact) args.push("--save-exact");
  args.push(...packages);

  return Object.freeze({
    command: manager,
    args: Object.freeze(args),
    printable: `${manager} ${args.join(" ")}`,
  });
}
