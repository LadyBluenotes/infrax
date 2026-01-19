import { addConfigItem, ensureConfigExists, loadConfig, saveConfig } from "../../config/index.js";
import { resolveConfigPath } from "./context.js";
import { formatSuccess } from "./shared.js";
import { normalizeType } from "./normalize.js";

export function registerAddCommand(program: import("commander").Command): void {
  program
    .command("add <type> <name>")
    .description("Add framework, rule, skill, or MCP server")
    .option("--global", "Target global config")
    .option("--config <path>", "Config file override")
    .action((type: string, name: string, options: { global?: boolean; config?: string }) => {
      const configPath = resolveConfigPath(options.global, options.config);
      ensureConfigExists(configPath);
      const config = loadConfig(configPath);
      const next = addConfigItem(config, normalizeType(type), name);
      saveConfig(configPath, next);
      console.log(formatSuccess(`Added ${type} ${name} to ${configPath}`));
    });
}
