import { detectContext, ensureConfigExists, loadConfig, saveConfig } from "../../config/index.js";
import { resolveConfigPath } from "./context.js";
import { formatSuccess, formatWarning } from "./shared.js";

export function registerInitCommand(program: import("commander").Command): void {
  program
    .command("init")
    .description("Initialize project config")
    .option("--global", "Create global config")
    .option("--template <name>", "Template name")
    .option("--config <path>", "Config file override")
    .action((options: { global?: boolean; template?: string; config?: string }) => {
      if (options.template) {
        console.log(formatWarning(`Template '${options.template}' not implemented yet`));
      }
      const configPath = resolveConfigPath(options.global, options.config);
      ensureConfigExists(configPath);
      const config = loadConfig(configPath);
      const context = detectContext(process.cwd());
      const next = {
        ...config,
        project: {
          ...(config.project ?? {}),
          root: config.project?.root ?? process.cwd(),
          context,
        },
      };
      saveConfig(configPath, next);
      console.log(formatSuccess(`Created ${configPath}`));
    });
}
