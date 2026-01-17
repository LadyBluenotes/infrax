#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveConfig, explainResolution } from "../resolver/index.js";
import { exportConfig, exportMcp } from "../exporters/index.js";
import { loadRootConfig, loadFullRegistry } from "../loaders/index.js";
import type {
  ExportTarget,
  McpExportTarget,
  EnableDisableSet,
  RuleId,
  AgentId,
  SkillId,
  McpServerId,
} from "../types/index.js";

const VERSION = "0.1.0";

function printHelp() {
  console.log(`
switchboard v${VERSION} - Portable, model-aware AI configuration

USAGE:
  switchboard <command> [options]

COMMANDS:
  resolve              Resolve configuration and output JSON
  list <type>          List items (rules, agents, skills, mcp)
  enable <id>          Enable an item (ephemeral unless --write)
  disable <id>         Disable an item (ephemeral unless --write)
  export <target>      Export to tool format (cursor, copilot, claude, mcp)
  explain              Show resolution trace
  check                Validate configuration
  help                 Show this help message

OPTIONS:
  --model <id>         Select model for resolution
  --context <id>       Select context for resolution
  --write              Persist changes to config / write export files
  --user               Target user-level config (for MCP exports)
  --force              Required with --user --write for safety
  --target <client>    MCP client target (vscode, cursor, claude-desktop, amazonq)
  --all                Show all items (not just active)
  --json               Output as JSON

EXAMPLES:
  switchboard resolve --model anthropic:claude-3.5-sonnet
  switchboard list rules --all
  switchboard enable rule:testing --write
  switchboard export cursor --write
  switchboard export mcp --target vscode --write
  switchboard export mcp --target claude-desktop --user --write --force
`);
}

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const result = {
    command: "",
    positional: [] as string[],
    flags: {} as Record<string, string | boolean>,
  };

  let i = 0;

  // First arg is command
  if (args.length > 0 && !args[0].startsWith("-")) {
    result.command = args[0];
    i = 1;
  }

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        result.flags[key] = nextArg;
        i += 2;
      } else {
        result.flags[key] = true;
        i += 1;
      }
    } else {
      result.positional.push(arg);
      i += 1;
    }
  }

  return result;
}

function getRepoRoot(): string {
  // Start from cwd and look for ai.config.jsonc
  let dir = process.cwd();

  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, "ai.config.jsonc")) ||
      fs.existsSync(path.join(dir, "ai.config.json"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  // Fall back to cwd
  return process.cwd();
}

function ensureDirectory(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (
    parsed.command === "help" ||
    parsed.flags.help ||
    parsed.command === ""
  ) {
    printHelp();
    process.exit(0);
  }

  const repoRoot = getRepoRoot();
  const model = parsed.flags.model as string | undefined;
  const context = parsed.flags.context as string | undefined;
  const write = parsed.flags.write === true;
  const userLevel = parsed.flags.user === true;
  const force = parsed.flags.force === true;
  const all = parsed.flags.all === true;
  const json = parsed.flags.json === true;

  try {
    switch (parsed.command) {
      case "resolve": {
        const resolved = resolveConfig({
          repoRoot,
          model,
          context: context as `context:${string}` | undefined,
        });

        if (resolved.trace.errors.length > 0) {
          console.error("Errors during resolution:");
          for (const err of resolved.trace.errors) {
            console.error(`  - ${err}`);
          }
          process.exit(1);
        }

        console.log(JSON.stringify(resolved, null, 2));
        break;
      }

      case "list": {
        const type = parsed.positional[0];
        if (!type || !["rules", "agents", "skills", "mcp"].includes(type)) {
          console.error("Usage: switchboard list <rules|agents|skills|mcp>");
          process.exit(1);
        }

        const rootConfig = loadRootConfig(repoRoot);
        const { registry, errors } = loadFullRegistry(repoRoot, rootConfig);

        if (errors.length > 0) {
          console.error("Errors loading registry:");
          for (const err of errors) {
            console.error(`  - ${err}`);
          }
        }

        const resolved = resolveConfig({
          repoRoot,
          model,
          context: context as `context:${string}` | undefined,
        });

        const activeIds = new Set<string>();
        if (type === "rules") {
          resolved.rules.forEach((r) => activeIds.add(r.id));
        } else if (type === "agents") {
          resolved.agents.forEach((a) => activeIds.add(a.id));
        } else if (type === "skills") {
          resolved.skills.forEach((s) => activeIds.add(s.id));
        } else if (type === "mcp") {
          resolved.mcpServers.forEach((m) => activeIds.add(m.id));
        }

        let items: { id: string; source?: string }[] = [];

        if (type === "rules") {
          items = Array.from(registry.rules.values()).map((r) => ({
            id: r.id,
            source: r.source?.type,
          }));
        } else if (type === "agents") {
          items = Array.from(registry.agents.values()).map((a) => ({
            id: a.id,
            source: a.source?.type,
          }));
        } else if (type === "skills") {
          items = Array.from(registry.skills.values()).map((s) => ({
            id: s.id,
            source: s.source?.type,
          }));
        } else if (type === "mcp") {
          items = Array.from(registry.mcpServers.values()).map((m) => ({
            id: m.id,
            source: m.source?.type,
          }));
        }

        if (!all) {
          items = items.filter((item) => activeIds.has(item.id));
        }

        if (json) {
          console.log(JSON.stringify(items, null, 2));
        } else {
          console.log(`\n${type.toUpperCase()} (${all ? "all" : "active"}):\n`);
          for (const item of items) {
            const status = activeIds.has(item.id) ? "[active]" : "[inactive]";
            const source = item.source ? `(${item.source})` : "";
            console.log(`  ${item.id} ${status} ${source}`);
          }
          console.log("");
        }
        break;
      }

      case "enable":
      case "disable": {
        const id = parsed.positional[0];
        if (!id) {
          console.error(`Usage: switchboard ${parsed.command} <id>`);
          process.exit(1);
        }

        if (!write) {
          // Ephemeral mode - just resolve with overlay
          const overlay: EnableDisableSet =
            parsed.command === "enable"
              ? { rules: [], agents: [], skills: [], mcpServers: [] }
              : { rules: [], agents: [], skills: [], mcpServers: [] };

          if (id.startsWith("rule:")) {
            if (parsed.command === "enable") {
              overlay.rules = [id as RuleId];
            } else {
              overlay.rules = [id as RuleId];
            }
          } else if (id.startsWith("agent:")) {
            if (parsed.command === "enable") {
              overlay.agents = [id as AgentId];
            } else {
              overlay.agents = [id as AgentId];
            }
          } else if (id.startsWith("skill:")) {
            if (parsed.command === "enable") {
              overlay.skills = [id as SkillId];
            } else {
              overlay.skills = [id as SkillId];
            }
          } else if (id.startsWith("mcp:")) {
            if (parsed.command === "enable") {
              overlay.mcpServers = [id as McpServerId];
            } else {
              overlay.mcpServers = [id as McpServerId];
            }
          }

          const cliOverlay =
            parsed.command === "enable"
              ? { enable: overlay, disable: undefined }
              : { enable: undefined, disable: overlay };

          const resolved = resolveConfig({
            repoRoot,
            model,
            context: context as `context:${string}` | undefined,
            cliOverlay,
          });

          console.log(
            `[ephemeral] ${parsed.command}d ${id} (use --write to persist)`
          );
          console.log(
            `Active items after change: ${resolved.rules.length} rules, ${resolved.agents.length} agents, ${resolved.skills.length} skills, ${resolved.mcpServers.length} mcp servers`
          );
        } else {
          // Write to config
          const configPath = fs.existsSync(
            path.join(repoRoot, "ai.config.jsonc")
          )
            ? path.join(repoRoot, "ai.config.jsonc")
            : path.join(repoRoot, "ai.config.json");

          const content = fs.readFileSync(configPath, "utf-8");

          // Simple approach: parse, modify, re-serialize
          // In production, you'd want to use jsonc-parser's edit functions to preserve comments
          const config = JSON.parse(
            content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
          );

          config.enable = config.enable ?? {};
          config.disable = config.disable ?? {};

          const listKey = id.startsWith("rule:")
            ? "rules"
            : id.startsWith("agent:")
              ? "agents"
              : id.startsWith("skill:")
                ? "skills"
                : "mcpServers";

          if (parsed.command === "enable") {
            config.enable[listKey] = config.enable[listKey] ?? [];
            if (!config.enable[listKey].includes(id)) {
              config.enable[listKey].push(id);
            }
            // Remove from disable if present
            config.disable[listKey] = (config.disable[listKey] ?? []).filter(
              (x: string) => x !== id
            );
          } else {
            config.disable[listKey] = config.disable[listKey] ?? [];
            if (!config.disable[listKey].includes(id)) {
              config.disable[listKey].push(id);
            }
            // Remove from enable if present
            config.enable[listKey] = (config.enable[listKey] ?? []).filter(
              (x: string) => x !== id
            );
          }

          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          console.log(`[persisted] ${parsed.command}d ${id} in ${configPath}`);
        }
        break;
      }

      case "export": {
        const target = parsed.positional[0] as ExportTarget | "mcp";

        if (
          !target ||
          !["cursor", "copilot", "claude", "mcp"].includes(target)
        ) {
          console.error(
            "Usage: switchboard export <cursor|copilot|claude|mcp> [--target <client>] [--write]"
          );
          process.exit(1);
        }

        const resolved = resolveConfig({
          repoRoot,
          model,
          context: context as `context:${string}` | undefined,
        });

        if (resolved.trace.errors.length > 0) {
          console.error("Errors during resolution:");
          for (const err of resolved.trace.errors) {
            console.error(`  - ${err}`);
          }
          process.exit(1);
        }

        let results;

        if (target === "mcp") {
          const mcpTarget = (parsed.flags.target as McpExportTarget) ?? "vscode";

          if (userLevel && write && !force) {
            console.error(
              "Error: Writing to user-level config requires --user --write --force"
            );
            process.exit(1);
          }

          results = exportMcp(resolved, mcpTarget, {
            repoRoot,
            home: process.env.HOME ?? "",
            userLevel,
          });
        } else {
          results = exportConfig(resolved, {
            repoRoot,
            targets: [target],
          });
        }

        if (results.length === 0) {
          console.log("No items to export for this target.");
          break;
        }

        for (const result of results) {
          if (write) {
            const fullPath = result.isUserLevel
              ? result.filePath
              : path.join(repoRoot, result.filePath);

            ensureDirectory(fullPath);
            fs.writeFileSync(fullPath, result.content);
            console.log(`Wrote: ${fullPath}`);
          } else {
            console.log(`\n--- ${result.filePath} ---`);
            console.log(result.content);
          }
        }
        break;
      }

      case "explain": {
        const trace = explainResolution({
          repoRoot,
          model,
          context: context as `context:${string}` | undefined,
        });

        if (json) {
          console.log(JSON.stringify(trace, null, 2));
        } else {
          console.log("\n=== Resolution Trace ===\n");

          console.log("Layers:");
          for (const layer of trace.layers) {
            const status = layer.enabled ? "enabled" : "disabled";
            console.log(`  ${layer.layer}: ${status}`);
            if (layer.enabled && Object.keys(layer.applied).length > 0) {
              console.log(`    applied: ${JSON.stringify(layer.applied)}`);
            }
          }

          console.log("\nActivations:");
          for (const activation of trace.activations) {
            console.log(
              `  ${activation.id}: ${activation.enabled ? "enabled" : "disabled"} (${activation.reason})`
            );
          }

          if (trace.warnings.length > 0) {
            console.log("\nWarnings:");
            for (const warning of trace.warnings) {
              console.log(`  - ${warning}`);
            }
          }

          if (trace.errors.length > 0) {
            console.log("\nErrors:");
            for (const error of trace.errors) {
              console.log(`  - ${error}`);
            }
          }
        }
        break;
      }

      case "check": {
        const resolved = resolveConfig({
          repoRoot,
          model,
          context: context as `context:${string}` | undefined,
        });

        const hasErrors = resolved.trace.errors.length > 0;
        const hasWarnings = resolved.trace.warnings.length > 0;

        if (hasErrors) {
          console.error("Configuration has errors:");
          for (const err of resolved.trace.errors) {
            console.error(`  - ${err}`);
          }
        }

        if (hasWarnings) {
          console.warn("Configuration has warnings:");
          for (const warning of resolved.trace.warnings) {
            console.warn(`  - ${warning}`);
          }
        }

        if (!hasErrors && !hasWarnings) {
          console.log("Configuration is valid.");
          console.log(
            `  ${resolved.rules.length} rules, ${resolved.agents.length} agents, ${resolved.skills.length} skills, ${resolved.mcpServers.length} mcp servers`
          );
        }

        process.exit(hasErrors ? 1 : 0);
        break;
      }

      default:
        console.error(`Unknown command: ${parsed.command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

main();
