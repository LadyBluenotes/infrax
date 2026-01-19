import { mergeConfigs } from "../../config/index.js";
import { loadConfigOrEmpty, resolveConfigPaths } from "./context.js";

export function registerResolveCommand(program: import("commander").Command): void {
  program
    .command("resolve")
    .description("Resolve config for debug")
    .option("--config <path>", "Config file override")
    .action((options: { config?: string }) => {
      const paths = resolveConfigPaths(options.config);
      const merged = mergeConfigs(loadConfigOrEmpty(paths.global), loadConfigOrEmpty(paths.project));
      console.log(JSON.stringify(merged.mergedConfig, null, 2));
    });
}
