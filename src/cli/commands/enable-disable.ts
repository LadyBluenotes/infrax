import { ensureConfigExists, loadConfig, saveConfig, toggleItem } from "../../config/index.js";
import { resolveConfigPath } from "./context.js";
import { formatSuccess } from "./shared.js";
import { normalizeType } from "./normalize.js";

function toggle(configPath: string, type: string, id: string, enabled: boolean): void {
  ensureConfigExists(configPath);
  const config = loadConfig(configPath);
  const normalized = normalizeType(type);
  if (normalized === "framework") {
    throw new Error("framework is not toggleable");
  }
  const next = toggleItem(config, normalized, id, enabled);
  saveConfig(configPath, next);
}

export function registerEnableDisableCommands(
  program: import("commander").Command
): void {
  program
    .command("enable <type> <name>")
    .description("Enable MCP server, rule, or skill")
    .option("--global", "Target global config")
    .option("--config <path>", "Config file override")
    .action((type: string, name: string, options: { global?: boolean; config?: string }) => {
      const configPath = resolveConfigPath(options.global, options.config);
      toggle(configPath, type, name, true);
      console.log(formatSuccess(`Enabled ${type} ${name} in ${configPath}`));
    });

  program
    .command("disable <type> <name>")
    .description("Disable MCP server, rule, or skill")
    .option("--global", "Target global config")
    .option("--config <path>", "Config file override")
    .action((type: string, name: string, options: { global?: boolean; config?: string }) => {
      const configPath = resolveConfigPath(options.global, options.config);
      toggle(configPath, type, name, false);
      console.log(formatSuccess(`Disabled ${type} ${name} in ${configPath}`));
    });
}
