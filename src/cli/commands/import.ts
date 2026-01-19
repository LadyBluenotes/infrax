import * as fs from "node:fs";
import type { ConfigDefinition } from "../../types/index.js";
import { saveConfig } from "../../config/index.js";
import { resolveConfigPath } from "./context.js";
import { formatError, formatSuccess } from "./shared.js";

export function registerImportCommand(program: import("commander").Command): void {
  program
    .command("import")
    .description("Import config from file")
    .option("--file <path>", "File path")
    .option("--config <path>", "Config file override")
    .action((options: { file?: string; config?: string }) => {
      if (!options.file) {
        console.error(formatError("Missing --file for import"));
        process.exit(1);
      }
      const configPath = resolveConfigPath(false, options.config);
      const raw = fs.readFileSync(options.file, "utf-8");
      const parsed = JSON.parse(raw) as ConfigDefinition;
      saveConfig(configPath, parsed);
      console.log(formatSuccess(`Imported ${options.file} into ${configPath}`));
    });
}
