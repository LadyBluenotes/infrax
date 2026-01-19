import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "yaml";
import { mergeConfigs, renderAgentsMdBlock } from "../../config/index.js";
import { loadConfigOrEmpty, resolveConfigPaths } from "./context.js";
import { formatSuccess } from "./shared.js";
import type { ConfigDefinition } from "../../types/index.js";

export function registerExportCommand(program: import("commander").Command): void {
  program
    .command("export")
    .description("Export config or AGENTS.md")
    .option("--format <format>", "json|yaml|md", "json")
    .option("--target <target>", "config|agents", "config")
    .option("--output <path>", "Output path")
    .option("--config <path>", "Config file override")
    .action((options: { format?: string; target?: string; output?: string; config?: string }) => {
      const paths = resolveConfigPaths(options.config);
      const merged = mergeConfigs(loadConfigOrEmpty(paths.global), loadConfigOrEmpty(paths.project));
      const target = options.target ?? "config";
      const format = options.format ?? "json";

      if (format === "md" && target !== "agents") {
        throw new Error("--format md only works with --target agents");
      }

      if (format === "yaml" && target === "agents") {
        throw new Error("--format yaml only works with --target config");
      }

      const output = options.output ?? defaultExportPath(target, format);
      const content = serializeExport(target, format, merged.mergedConfig);
      fs.writeFileSync(output, content);
      console.log(formatSuccess(`Wrote ${output}`));
    });
}

function defaultExportPath(target: string, format: string): string {
  if (target === "agents" || format === "md") {
    return path.join(process.cwd(), "AGENTS.md");
  }
  const filename = format === "yaml" ? "config.yaml" : "config.json";
  return path.join(process.cwd(), filename);
}

function serializeExport(target: string, format: string, config: ConfigDefinition): string {
  if (target === "agents" || format === "md") {
    return renderAgentsMdBlock(config);
  }
  if (format === "yaml") {
    return yaml.stringify(config);
  }
  return JSON.stringify(config, null, 2);
}
