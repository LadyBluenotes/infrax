import * as path from "node:path";

export function getGlobalConfigPath(): string {
  const home = process.env.HOME ?? "";
  return path.join(home, ".infrax", "config.jsonc");
}

export function normalizeConfigPath(filePath: string): string {
  return path.resolve(filePath);
}

export function getProjectConfigPath(repoRoot: string): string {
  return path.join(repoRoot, ".infrax", "config.jsonc");
}
