import * as fs from "node:fs";
import {
  mergeConfigs,
  saveConfig,
  updateAgentsMdFile,
  resolveAgentsMdPath,
} from "../../config/index.js";
import { loadConfigOrEmpty, resolveConfigPaths } from "./context.js";
import { formatSuccess, formatWarning } from "./shared.js";

export function registerUpdateCommand(program: import("commander").Command): void {
  program
    .command("update")
    .description("Sync configs and AGENTS.md")
    .option("--dry-run", "Show planned changes")
    .option("--merge", "Write merged config")
    .option("--config <path>", "Config file override")
    .action((options: { dryRun?: boolean; merge?: boolean; config?: string }) => {
      const paths = resolveConfigPaths(options.config);
      const globalConfig = loadConfigOrEmpty(paths.global);
      const projectConfig = loadConfigOrEmpty(paths.project);
      const result = mergeConfigs(globalConfig, projectConfig);

      if (result.conflicts.length > 0) {
        for (const conflict of result.conflicts) {
          console.log(formatWarning(conflict.message));
        }
      }

      if (options.merge) {
        saveConfig(paths.project, result.mergedConfig);
        console.log(formatSuccess(`Updated ${paths.project}`));
      }

      const agentsPath = resolveAgentsMdPath(process.cwd());
      const update = updateAgentsMdFile(agentsPath, result.mergedConfig);
      if (options.dryRun) {
        console.log(update.content);
      } else if (update.updated) {
        fs.writeFileSync(agentsPath, update.content);
        console.log(formatSuccess(`Updated ${agentsPath}`));
      } else {
        console.log(formatSuccess("AGENTS.md already up to date"));
      }
    });
}
