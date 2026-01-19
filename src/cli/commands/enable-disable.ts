import * as fs from "node:fs";
import * as path from "node:path";
import type {
  AgentId,
  EnableDisableSet,
  McpServerId,
  RuleId,
  SkillId,
} from "../../types/index.js";
import { resolveConfig } from "../../resolver/index.js";
import { formatError, colors, formatSuccess } from "./shared.js";

export function runEnableDisable(args: {
  command: "enable" | "disable";
  id?: string;
  repoRoot: string;
  model?: string;
  context?: string;
  write: boolean;
}): void {
  const id = args.id;
  if (!id) {
    console.error(
      formatError(
        "Missing item ID",
        `Usage: infrax ${args.command} <rule:id|agent:id|skill:id|mcp:id>`
      )
    );
    process.exit(1);
  }

  // Validate ID format
  if (!id.match(/^(rule|agent|skill|mcp):.+$/)) {
    console.error(
      formatError(
        `Invalid ID format: "${id}"`,
        "IDs must be prefixed with rule:, agent:, skill:, or mcp:"
      )
    );
    process.exit(1);
  }

  if (!args.write) {
    // Ephemeral mode - just resolve with overlay
    const overlay: EnableDisableSet = {
      rules: [],
      agents: [],
      skills: [],
      mcpServers: [],
    };

    const listKey = id.startsWith("rule:")
      ? "rules"
      : id.startsWith("agent:")
        ? "agents"
        : id.startsWith("skill:")
          ? "skills"
          : "mcpServers";

    if (listKey === "rules") overlay.rules = [id as RuleId];
    else if (listKey === "agents") overlay.agents = [id as AgentId];
    else if (listKey === "skills") overlay.skills = [id as SkillId];
    else overlay.mcpServers = [id as McpServerId];

    const cliOverlay =
      args.command === "enable"
        ? { enable: overlay, disable: undefined }
        : { enable: undefined, disable: overlay };

    const resolved = resolveConfig({
      repoRoot: args.repoRoot,
      model: args.model,
      context: args.context as `context:${string}` | undefined,
      cliOverlay,
    });

    console.log(`${colors.yellow}[ephemeral]${colors.reset} ${args.command}d ${id}`);
    console.log(`${colors.dim}Use --write to persist this change${colors.reset}`);
    console.log(
      `\nActive: ${resolved.rules.length} rules, ${resolved.agents.length} agents, ${resolved.skills.length} skills, ${resolved.mcpServers.length} mcp servers`
    );
    return;
  }

  // Write to config
  const dotAiJsonc = path.join(args.repoRoot, ".ai", "config.jsonc");
  const dotAiJson = path.join(args.repoRoot, ".ai", "config.json");
  const rootJsonc = path.join(args.repoRoot, "ai.config.jsonc");
  const rootJson = path.join(args.repoRoot, "ai.config.json");

  let configPath: string | null = null;
  if (fs.existsSync(dotAiJsonc)) configPath = dotAiJsonc;
  else if (fs.existsSync(dotAiJson)) configPath = dotAiJson;
  else if (fs.existsSync(rootJsonc)) configPath = rootJsonc;
  else if (fs.existsSync(rootJson)) configPath = rootJson;

  if (!configPath) {
    console.error(
      formatError(
        "No configuration file found",
        "Expected one of of: .ai/config.jsonc, .ai/config.json, ai.config.jsonc, ai.config.json"
      )
    );
    process.exit(1);
  }

  const content = fs.readFileSync(configPath, "utf-8");

  // Parse with comment stripping
  const config = JSON.parse(content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""));

  config.enable = config.enable ?? {};
  config.disable = config.disable ?? {};

  const listKey = id.startsWith("rule:")
    ? "rules"
    : id.startsWith("agent:")
      ? "agents"
      : id.startsWith("skill:")
        ? "skills"
        : "mcpServers";

  if (args.command === "enable") {
    config.enable[listKey] = config.enable[listKey] ?? [];
    if (!config.enable[listKey].includes(id)) {
      config.enable[listKey].push(id);
    }
    config.disable[listKey] = (config.disable[listKey] ?? []).filter(
      (x: string) => x !== id
    );
  } else {
    config.disable[listKey] = config.disable[listKey] ?? [];
    if (!config.disable[listKey].includes(id)) {
      config.disable[listKey].push(id);
    }
    config.enable[listKey] = (config.enable[listKey] ?? []).filter(
      (x: string) => x !== id
    );
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(formatSuccess(`${args.command}d ${id} in ${configPath}`));
}
