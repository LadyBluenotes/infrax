import * as path from "node:path";
import type { RootConfig } from "../types/index.js";
import { fileExists, readJsoncFile } from "../utils/index.js";

export type RootConfigLocation = {
  configPath: string;
  baseDir: string;
  isDotAi: boolean;
};

const ROOT_CONFIG_FILES = ["ai.config.jsonc", "ai.config.json"];
const DOT_AI_CONFIG_FILES = [".ai/config.jsonc", ".ai/config.json"];

export function findRootConfig(repoRoot: string): RootConfigLocation | null {
  for (const rel of DOT_AI_CONFIG_FILES) {
    const configPath = path.join(repoRoot, rel);
    if (fileExists(configPath)) {
      return {
        configPath,
        baseDir: path.dirname(configPath),
        isDotAi: true,
      };
    }
  }

  for (const rel of ROOT_CONFIG_FILES) {
    const configPath = path.join(repoRoot, rel);
    if (fileExists(configPath)) {
      return {
        configPath,
        baseDir: repoRoot,
        isDotAi: false,
      };
    }
  }

  return null;
}

export function loadRootConfig(repoRoot: string): RootConfig {
  const found = findRootConfig(repoRoot);
  if (!found) {
    const expected = [...DOT_AI_CONFIG_FILES, ...ROOT_CONFIG_FILES].join(", ");
    throw new Error(`No configuration file found. Expected one of: ${expected}`);
  }

  const config = readJsoncFile<RootConfig>(found.configPath);

  return {
    ...config,
    version: 1,
    // When config lives under .ai/, use .ai/* as defaults unless user overrides.
    include: {
      ...(found.isDotAi
        ? {
            rulesDir: ".ai/rules",
            agentsDir: ".ai/agents",
            skillsDir: ".ai/skills",
            mcpDir: ".ai/mcp",
            contextsDir: ".ai/contexts",
            modelsDir: ".ai/models",
          }
        : null),
      ...(config.include ?? {}),
    },
  };
}
