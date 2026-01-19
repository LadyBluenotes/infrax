import { mergeConfigs, saveConfig } from "../../config/index.js";
import { loadConfigOrEmpty, resolveConfigPaths } from "./context.js";
import { formatSuccess } from "./shared.js";

export function registerSyncCommand(program: import("commander").Command): void {
  program
    .command("sync")
    .description("Merge global + local")
    .option("--config <path>", "Config file override")
    .action((options: { config?: string }) => {
      const paths = resolveConfigPaths(options.config);
      const merged = mergeConfigs(loadConfigOrEmpty(paths.global), loadConfigOrEmpty(paths.project));
      saveConfig(paths.project, merged.mergedConfig);
      console.log(formatSuccess(`Synced ${paths.project}`));
    });
}
