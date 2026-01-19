import { mergeConfigs } from "../../config/index.js";
import { loadConfigOrEmpty, resolveConfigPaths } from "./context.js";
import { formatWarning } from "./shared.js";
import { normalizeType } from "./normalize.js";
import type { ConfigDefinition } from "../../types/index.js";

export function registerListCommand(program: import("commander").Command): void {
  program
    .command("list <type>")
    .description("List rules, skills, MCP servers, frameworks")
    .option("--local", "List local config")
    .option("--registry", "List registry items")
    .option("--config <path>", "Config file override")
    .action((type: string, options: { config?: string; local?: boolean; registry?: boolean }) => {
      if (options.local) {
        const paths = resolveConfigPaths(options.config);
        const config = loadConfigOrEmpty(paths.project);
        const items = listItems(config, type);
        console.log(JSON.stringify(items, null, 2));
        return;
      }
      if (options.registry) {
        console.log(formatWarning("Registry listing not implemented yet"));
        return;
      }
      const paths = resolveConfigPaths(options.config);
      const merged = mergeConfigs(loadConfigOrEmpty(paths.global), loadConfigOrEmpty(paths.project));
      const items = listItems(merged.mergedConfig, type);
      console.log(JSON.stringify(items, null, 2));
    });
}

function listItems(config: ConfigDefinition, type: string): unknown {
  const normalized = normalizeType(type);
  if (normalized === "framework") {
    return config.project?.context?.frameworks ?? [];
  }
  if (normalized === "rule") return config.rules ?? [];
  if (normalized === "skill") return config.skills ?? [];
  if (normalized === "mcp-server") return config.mcpServers ?? [];
  return config.agents ?? [];
}
