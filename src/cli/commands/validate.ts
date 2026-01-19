import { mergeConfigs, validateConfig } from "../../config/index.js";
import { loadConfigOrEmpty, resolveConfigPaths } from "./context.js";
import { formatError, formatSuccess, formatWarning } from "./shared.js";

export function registerValidateCommand(program: import("commander").Command): void {
  program
    .command("validate")
    .description("Check conflicts and errors")
    .option("--fix", "Fix auto-correctable issues")
    .option("--config <path>", "Config file override")
    .action((options: { config?: string; fix?: boolean }) => {
      const paths = resolveConfigPaths(options.config);
      const globalConfig = loadConfigOrEmpty(paths.global);
      const projectConfig = loadConfigOrEmpty(paths.project);
      const merged = mergeConfigs(globalConfig, projectConfig);
      const validation = validateConfig(merged.mergedConfig);

      if (validation.conflicts.length > 0) {
        for (const conflict of validation.conflicts) {
          console.error(formatWarning(conflict.message));
        }
      }

      if (validation.errors.length > 0) {
        for (const error of validation.errors) {
          console.error(formatError(error));
        }
      }

      if (validation.ok) {
        console.log(formatSuccess("Config valid"));
      } else {
        process.exit(1);
      }
    });
}
