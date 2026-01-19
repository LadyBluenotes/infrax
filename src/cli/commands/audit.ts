import * as fs from "node:fs";
import { mergeConfigs, resolveAgentsMdPath, updateAgentsMdFile } from "../../config/index.js";
import { loadConfigOrEmpty, resolveConfigPaths } from "./context.js";
import { formatSuccess, formatWarning } from "./shared.js";

export function registerAuditCommand(program: import("commander").Command): void {
  program
    .command("audit")
    .description("Verify AGENTS.md matches config")
    .option("--config <path>", "Config file override")
    .action((options: { config?: string }) => {
      const paths = resolveConfigPaths(options.config);
      const merged = mergeConfigs(loadConfigOrEmpty(paths.global), loadConfigOrEmpty(paths.project));
      const agentsPath = resolveAgentsMdPath(process.cwd());
      const update = updateAgentsMdFile(agentsPath, merged.mergedConfig);

      if (!fs.existsSync(agentsPath)) {
        console.log(formatWarning(`Missing ${agentsPath}`));
        process.exit(1);
      }

      if (update.updated) {
        console.log(formatWarning("AGENTS.md out of sync"));
        process.exit(1);
      }

      console.log(formatSuccess("AGENTS.md matches config"));
    });
}
