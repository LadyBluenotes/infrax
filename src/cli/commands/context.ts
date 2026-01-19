import * as fs from "node:fs";
import * as path from "node:path";
import type { ConfigDefinition } from "../../types/index.js";
import { createEmptyConfig, loadConfig } from "../../config/index.js";
import { getGlobalConfigPath, getProjectConfigPath } from "../../utils/paths.js";

export function resolveConfigPaths(configOverride?: string): {
  global: string;
  project: string;
} {
  if (configOverride) {
    const resolved = path.resolve(configOverride);
    return { global: resolved, project: resolved };
  }
  return {
    global: getGlobalConfigPath(),
    project: getProjectConfigPath(process.cwd()),
  };
}

export function resolveConfigPath(
  isGlobal?: boolean,
  configOverride?: string
): string {
  if (configOverride) {
    return path.resolve(configOverride);
  }
  if (isGlobal) {
    return getGlobalConfigPath();
  }
  return getProjectConfigPath(process.cwd());
}

export function loadConfigOrEmpty(filePath: string): ConfigDefinition {
  if (!fs.existsSync(filePath)) {
    return createEmptyConfig();
  }
  return loadConfig(filePath);
}
