#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { resolveConfig, explainResolution } from "../resolver/index.js";
import { exportConfig, exportMcp } from "../exporters/index.js";
import { loadRootConfig, loadFullRegistry } from "../loaders/index.js";
import { importAgentsMd } from "../loaders/agents-md.js";
import {
  parseMcpFlagValues,
  resolveMcpRef,
  getMcpCatalogEntries,
  MCP_CATALOG,
} from "../mcp/catalog.js";
import type {
  ExportTarget,
  McpExportTarget,
  EnableDisableSet,
  RuleId,
  AgentId,
  SkillId,
  McpServerId,
  ExportResult,
} from "../types/index.js";

const VERSION = "0.1.0";

// ANSI colors for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function sketchMcpServer(repoRoot: string, alias: string): string {
  const entry = MCP_CATALOG[alias];
  const filePath = path.join(repoRoot, "ai", "mcp", `${alias}.jsonc`);
  ensureDirectory(filePath);
  fs.writeFileSync(filePath, JSON.stringify(entry.template, null, 2));
  return filePath;
}

function buildCliOverlayFromMcpFlags(parsed: { flags: Record<string, unknown> }):
  | {
      ok: true;
      cliOverlay?: { enable?: EnableDisableSet; disable?: EnableDisableSet };
      requestedAliases: string[];
    }
  | { ok: false; error: string } {
  const mcpNone = parsed.flags["mcp-none"] === true;
  const mcpRefs = parseMcpFlagValues(parsed.flags.mcp);

  if (mcpRefs.length === 0 && !mcpNone) {
    return { ok: true, cliOverlay: undefined, requestedAliases: [] };
  }

  if (mcpNone) {
    return {
      ok: true,
      cliOverlay: { enable: { mcpServers: [] } },
      requestedAliases: [],
    };
  }

  const ids: McpServerId[] = [];
  const aliases: string[] = [];

  for (const ref of mcpRefs) {
    const resolved = resolveMcpRef(ref);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    ids.push(resolved.id);
    if (resolved.alias) aliases.push(resolved.alias);
  }

  return {
    ok: true,
    cliOverlay: { enable: { mcpServers: ids } },
    requestedAliases: aliases,
  };
}

function printHelp() {
  console.log(`
${colors.bold}infrax v${VERSION}${colors.reset} - Portable, model-aware AI configuration


${colors.bold}USAGE:${colors.reset}
  infrax <command> [options]

${colors.bold}COMMANDS:${colors.reset}
  init                 Initialize a new ai.config.jsonc in current directory
  resolve              Resolve configuration and output JSON
  list <type>          List items (rules, agents, skills, mcp)
  enable <id>          Enable an item (ephemeral unless --write)
  disable <id>         Disable an item (ephemeral unless --write)
  export <target>      Export to tool format (cursor, copilot, claude, mcp, all)
  explain              Show resolution trace
  check                Validate configuration (add --exports to check generated files)
  drift                Show differences between generated and committed exports
  help                 Show this help message

${colors.bold}OPTIONS:${colors.reset}
  --model <id>         Select model for resolution
  --context <id>       Select context for resolution
  --write              Persist changes to config / write export files
  --user               Target user-level config (for MCP exports)
  --force              Required with --user --write for safety
  --target <client>    MCP client target (vscode, cursor, claude-desktop, amazonq)
  --mcp <name>         Enable MCP server by alias (e.g. filesystem) or id (mcp:foo); repeatable; supports comma-separated
  --mcp-none           Disable all MCP servers for this run (overrides config)
  --catalog            With 'list mcp': show built-in MCP catalog aliases
  --all                Show all items (not just active)
  --json               Output as JSON
  --exports            Check that generated exports match committed files

${colors.bold}EXAMPLES:${colors.reset}
  infrax init
  infrax resolve --model anthropic:claude-3.5-sonnet
  infrax list rules --all
  infrax enable rule:testing --write
  infrax export cursor --write
  infrax export all --write
  infrax export mcp --target vscode --write
  infrax export mcp --target claude-desktop --user --write --force
  infrax export mcp --target vscode --mcp filesystem --mcp github --write
  infrax list mcp --catalog
  infrax check --exports
  infrax drift
`);
}

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean | string[]>;
} {
  const result = {
    command: "",
    positional: [] as string[],
    flags: {} as Record<string, string | boolean | string[]>,
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
        const val = nextArg;
        const existing = result.flags[key];
        if (existing === undefined) {
          result.flags[key] = val;
        } else if (Array.isArray(existing)) {
          existing.push(val);
          result.flags[key] = existing;
        } else {
          result.flags[key] = [String(existing), val];
        }
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

function formatError(message: string, hint?: string): string {
  let output = `${colors.red}Error:${colors.reset} ${message}`;
  if (hint) {
    output += `\n${colors.dim}Hint: ${hint}${colors.reset}`;
  }
  return output;
}

function formatWarning(message: string): string {
  return `${colors.yellow}Warning:${colors.reset} ${message}`;
}

function formatSuccess(message: string): string {
  return `${colors.green}✓${colors.reset} ${message}`;
}

/**
 * Load AGENTS.md content based on config settings.
 */
function loadAgentsMdForExport(
  repoRoot: string,
  workingDir: string
): { content?: string; includeIn?: "claude" | "all" | "none" } {
  try {
    const rootConfig = loadRootConfig(repoRoot);
    const agentsMdConfig = rootConfig.imports?.agentsMd;

    if (!agentsMdConfig?.enabled) {
      return {};
    }

    const result = importAgentsMd(repoRoot, workingDir, {
      enabled: agentsMdConfig.enabled,
      mode: agentsMdConfig.mode,
    });

    if (!result) {
      return {};
    }

    return {
      content: result.content,
      includeIn: agentsMdConfig.includeIn ?? "claude",
    };
  } catch {
    // If config loading fails, just skip AGENTS.md
    return {};
  }
}

/**
 * Generate all exports for comparison or writing.
 */
function generateAllExports(
  repoRoot: string,
  model?: string,
  context?: string
): ExportResult[] {
  const resolved = resolveConfig({
    repoRoot,
    model,
    context: context as `context:${string}` | undefined,
  });

  if (resolved.trace.errors.length > 0) {
    throw new Error(
      `Resolution errors:\n${resolved.trace.errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }

  // Load AGENTS.md content if configured
  const agentsMd = loadAgentsMdForExport(repoRoot, process.cwd());

  const results: ExportResult[] = [];

  // Export all tool configs
  results.push(
    ...exportConfig(resolved, {
      repoRoot,
      targets: ["cursor", "copilot", "claude"],
      agentsMdContent: agentsMd.content,
      agentsMdIncludeIn: agentsMd.includeIn,
    })
  );

  // Export MCP for VS Code (most common repo-level target)
  results.push(
    ...exportMcp(resolved, "vscode", {
      repoRoot,
      home: process.env.HOME ?? "",
      userLevel: false,
    })
  );

  return results;
}

/**
 * Compare generated exports with existing files.
 */
function checkExports(repoRoot: string, model?: string, context?: string): {
  matches: string[];
  mismatches: Array<{ path: string; reason: string }>;
  missing: string[];
} {
  const results = generateAllExports(repoRoot, model, context);

  const matches: string[] = [];
  const mismatches: Array<{ path: string; reason: string }> = [];
  const missing: string[] = [];

  for (const result of results) {
    if (result.isUserLevel) continue; // Skip user-level configs

    const fullPath = path.join(repoRoot, result.filePath);

    if (!fs.existsSync(fullPath)) {
      missing.push(result.filePath);
      continue;
    }

    const existing = fs.readFileSync(fullPath, "utf-8");

    // Normalize content for comparison (ignore timestamp differences)
    const normalizeContent = (content: string): string => {
      return content
        .replace(/Generated at: .*$/gm, "Generated at: [TIMESTAMP]")
        .replace(/"at": ".*"$/gm, '"at": "[TIMESTAMP]"')
        .trim();
    };

    if (normalizeContent(existing) === normalizeContent(result.content)) {
      matches.push(result.filePath);
    } else {
      mismatches.push({
        path: result.filePath,
        reason: "Content differs from generated output",
      });
    }
  }

  return { matches, mismatches, missing };
}

/**
 * Show drift between generated and committed exports.
 */
function showDrift(repoRoot: string, model?: string, context?: string): void {
  const results = generateAllExports(repoRoot, model, context);

  let hasDrift = false;

  for (const result of results) {
    if (result.isUserLevel) continue;

    const fullPath = path.join(repoRoot, result.filePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`\n${colors.yellow}MISSING:${colors.reset} ${result.filePath}`);
      console.log(`${colors.dim}  File does not exist. Run 'infrax export' to create.${colors.reset}`);
      hasDrift = true;
      continue;
    }

    const existing = fs.readFileSync(fullPath, "utf-8");

    // Simple line-by-line diff (excluding timestamps)
    const existingLines = existing.split("\n");
    const generatedLines = result.content.split("\n");

    const diffs: Array<{ line: number; type: "add" | "remove"; content: string }> = [];

    // Find differences (simple approach)
    const maxLines = Math.max(existingLines.length, generatedLines.length);
    for (let i = 0; i < maxLines; i++) {
      const existingLine = existingLines[i] ?? "";
      const generatedLine = generatedLines[i] ?? "";

      // Skip timestamp lines
      if (
        existingLine.includes("Generated at:") ||
        existingLine.includes('"at":') ||
        generatedLine.includes("Generated at:") ||
        generatedLine.includes('"at":')
      ) {
        continue;
      }

      if (existingLine !== generatedLine) {
        if (existingLine) {
          diffs.push({ line: i + 1, type: "remove", content: existingLine });
        }
        if (generatedLine) {
          diffs.push({ line: i + 1, type: "add", content: generatedLine });
        }
      }
    }

    if (diffs.length > 0) {
      console.log(`\n${colors.yellow}CHANGED:${colors.reset} ${result.filePath}`);
      for (const diff of diffs.slice(0, 20)) {
        // Limit to first 20 diffs
        if (diff.type === "remove") {
          console.log(`${colors.red}  - ${diff.content}${colors.reset}`);
        } else {
          console.log(`${colors.green}  + ${diff.content}${colors.reset}`);
        }
      }
      if (diffs.length > 20) {
        console.log(`${colors.dim}  ... and ${diffs.length - 20} more differences${colors.reset}`);
      }
      hasDrift = true;
    }
  }

  if (!hasDrift) {
    console.log(formatSuccess("All exports are up to date."));
  }
}

/**
 * Interactive init command.
 */
async function runInit(repoRoot: string): Promise<void> {
  const configPath = path.join(repoRoot, "ai.config.jsonc");

  if (fs.existsSync(configPath)) {
    console.log(formatError(
      "ai.config.jsonc already exists",
      "Delete the existing file or run from a different directory"
    ));
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log(`\n${colors.bold}infrax init${colors.reset}\n`);
  console.log("This will create a new ai.config.jsonc and example files.\n");

  const projectName = await question("Project name (for context): ");
  const useTypeScript = (await question("Using TypeScript? (Y/n): ")).toLowerCase() !== "n";
  const addMcp = (await question("Include MCP server examples? (Y/n): ")).toLowerCase() !== "n";

  rl.close();

  // Create directories
  const dirs = ["ai/rules", "ai/agents", "ai/skills"];
  if (addMcp) dirs.push("ai/mcp");
  dirs.push("ai/contexts");

  for (const dir of dirs) {
    const fullDir = path.join(repoRoot, dir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }
  }

  // Create config
  const config = {
    version: 1,
    include: {
      rulesDir: "ai/rules",
      agentsDir: "ai/agents",
      skillsDir: "ai/skills",
      mcpDir: addMcp ? "ai/mcp" : undefined,
      contextsDir: "ai/contexts",
    },
    defaults: {
      context: `context:${projectName || "default"}` as const,
    },
    enable: {
      rules: ["rule:code-style"] as `rule:${string}`[],
      agents: ["agent:coding"] as `agent:${string}`[],
      skills: [] as `skill:${string}`[],
      mcpServers: [] as `mcp:${string}`[],
    },
    disable: {
      rules: [] as `rule:${string}`[],
      agents: [] as `agent:${string}`[],
      skills: [] as `skill:${string}`[],
      mcpServers: [] as `mcp:${string}`[],
    },
    policy: {
      allowMissingDependencies: false,
      allowOverrides: true,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(formatSuccess(`Created ${configPath}`));

  // Create example rule
  const ruleContent = `---
id: rule:code-style
targets: [cursor, copilot, claude]
---

## Code Style

${useTypeScript ? "- Use TypeScript for all new code\n" : ""}- Write clean, readable code
- Use meaningful variable and function names
- Keep functions small and focused
- Add comments for complex logic
`;

  fs.writeFileSync(path.join(repoRoot, "ai/rules/code-style.md"), ruleContent);
  console.log(formatSuccess("Created ai/rules/code-style.md"));

  // Create example agent
  const agentContent = {
    id: "agent:coding",
    instructions: "You are a helpful coding assistant. Follow project conventions and best practices.",
    rules: ["rule:code-style"],
    skills: [],
  };

  fs.writeFileSync(
    path.join(repoRoot, "ai/agents/coding.jsonc"),
    JSON.stringify(agentContent, null, 2)
  );
  console.log(formatSuccess("Created ai/agents/coding.jsonc"));

  // Create example context
  const contextContent = {
    id: `context:${projectName || "default"}`,
    description: `${projectName || "Default"} project context`,
    enable: {
      rules: ["rule:code-style"],
    },
  };

  fs.writeFileSync(
    path.join(repoRoot, `ai/contexts/${projectName || "default"}.jsonc`),
    JSON.stringify(contextContent, null, 2)
  );
  console.log(formatSuccess(`Created ai/contexts/${projectName || "default"}.jsonc`));

  // Create example MCP server if requested
  if (addMcp) {
    const mcpContent = {
      id: "mcp:filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "${repoRoot}"],
      env: {},
    };

    fs.writeFileSync(
      path.join(repoRoot, "ai/mcp/filesystem.jsonc"),
      JSON.stringify(mcpContent, null, 2)
    );
    console.log(formatSuccess("Created ai/mcp/filesystem.jsonc"));
  }

  console.log(`
${colors.bold}Next steps:${colors.reset}
  1. Edit ai/rules/*.md to add your project rules
  2. Run ${colors.blue}infrax check${colors.reset} to validate
  3. Run ${colors.blue}infrax export all --write${colors.reset} to generate tool configs
  4. Commit the generated files to your repo
`);
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
  const checkExportsFlag = parsed.flags.exports === true;

  try {
    switch (parsed.command) {
      case "init": {
        await runInit(process.cwd());
        break;
      }

      case "resolve": {
        const overlayResult = buildCliOverlayFromMcpFlags(parsed as { flags: Record<string, unknown> });
        if (!overlayResult.ok) {
          console.error(formatError(overlayResult.error));
          process.exit(1);
        }

        const resolved = resolveConfig({
          repoRoot,
          model,
          context: context as `context:${string}` | undefined,
          cliOverlay: overlayResult.cliOverlay,
        });

        if (resolved.trace.errors.length > 0) {
          console.error(formatError("Resolution failed"));
          for (const err of resolved.trace.errors) {
            console.error(`  - ${err}`);
          }
          process.exit(1);
        }

        console.log(JSON.stringify(resolved, null, 2));
        break;
      }

       case "list": {
         if (parsed.positional[0] === "mcp" && parsed.flags.catalog === true) {
           const entries = getMcpCatalogEntries();
           if (json) {
             console.log(JSON.stringify(entries, null, 2));
           } else {
             console.log(`\n${colors.bold}MCP CATALOG${colors.reset}\n`);
             for (const entry of entries) {
               console.log(`  ${entry.alias} ${colors.dim}-> ${entry.id}${colors.reset}`);
               console.log(`    ${colors.dim}${entry.description}${colors.reset}`);
             }
             console.log("");
           }
           break;
         }

         const type = parsed.positional[0];
        if (!type || !["rules", "agents", "skills", "mcp"].includes(type)) {
          console.error(formatError(
            "Invalid list type",
            "Usage: infrax list <rules|agents|skills|mcp>"
          ));
          process.exit(1);
        }

        const rootConfig = loadRootConfig(repoRoot);
        const { registry, errors } = loadFullRegistry(repoRoot, rootConfig);

        if (errors.length > 0) {
          for (const err of errors) {
            console.error(formatWarning(err));
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
          console.log(`\n${colors.bold}${type.toUpperCase()}${colors.reset} (${all ? "all" : "active"}):\n`);
          if (items.length === 0) {
            console.log(`  ${colors.dim}No items found${colors.reset}`);
          } else {
            for (const item of items) {
              const status = activeIds.has(item.id)
                ? `${colors.green}[active]${colors.reset}`
                : `${colors.dim}[inactive]${colors.reset}`;
              const source = item.source ? `${colors.dim}(${item.source})${colors.reset}` : "";
              console.log(`  ${item.id} ${status} ${source}`);
            }
          }
          console.log("");
        }
        break;
      }

      case "enable":
      case "disable": {
        const id = parsed.positional[0];
        if (!id) {
          console.error(formatError(
            "Missing item ID",
            `Usage: infrax ${parsed.command} <rule:id|agent:id|skill:id|mcp:id>`
          ));
          process.exit(1);
        }

        // Validate ID format
        if (!id.match(/^(rule|agent|skill|mcp):.+$/)) {
          console.error(formatError(
            `Invalid ID format: "${id}"`,
            "IDs must be prefixed with rule:, agent:, skill:, or mcp:"
          ));
          process.exit(1);
        }

        if (!write) {
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
            `${colors.yellow}[ephemeral]${colors.reset} ${parsed.command}d ${id}`
          );
          console.log(`${colors.dim}Use --write to persist this change${colors.reset}`);
          console.log(
            `\nActive: ${resolved.rules.length} rules, ${resolved.agents.length} agents, ${resolved.skills.length} skills, ${resolved.mcpServers.length} mcp servers`
          );
        } else {
          // Write to config
          const configPath = fs.existsSync(
            path.join(repoRoot, "ai.config.jsonc")
          )
            ? path.join(repoRoot, "ai.config.jsonc")
            : path.join(repoRoot, "ai.config.json");

          const content = fs.readFileSync(configPath, "utf-8");

          // Parse with comment stripping
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
          console.log(formatSuccess(`${parsed.command}d ${id} in ${configPath}`));
        }
        break;
      }

       case "export": {
         const target = parsed.positional[0] as ExportTarget | "mcp" | "all";

         const overlayResult = buildCliOverlayFromMcpFlags(parsed as { flags: Record<string, unknown> });
         if (!overlayResult.ok) {
           console.error(formatError(overlayResult.error));
           process.exit(1);
         }

         const requestedAliases = overlayResult.requestedAliases;

         // If MCP aliases were requested and we're writing, scaffold missing definitions into ai/mcp/.
         if (write && requestedAliases.length > 0) {
           const rootConfig = loadRootConfig(repoRoot);
           const { registry } = loadFullRegistry(repoRoot, rootConfig);

           for (const alias of requestedAliases) {
             const id = MCP_CATALOG[alias]?.id;
             if (!id) continue;
             if (!registry.mcpServers.has(id)) {
               const createdPath = sketchMcpServer(repoRoot, alias);
               console.log(formatSuccess(`Created ${createdPath}`));
             }
           }
         }


        if (
          !target ||
          !["cursor", "copilot", "claude", "mcp", "all"].includes(target)
        ) {
          console.error(formatError(
            "Invalid export target",
            "Usage: infrax export <cursor|copilot|claude|mcp|all> [--write]"
          ));
          process.exit(1);
        }

        const resolved = resolveConfig({
          repoRoot,
          model,
          context: context as `context:${string}` | undefined,
          cliOverlay: overlayResult.cliOverlay,
        });

        if (resolved.trace.errors.length > 0) {
          console.error(formatError("Resolution failed"));
          for (const err of resolved.trace.errors) {
            console.error(`  - ${err}`);
          }
          process.exit(1);
        }

        let results: ExportResult[];

        if (target === "all") {
          results = generateAllExports(repoRoot, model, context);
        } else if (target === "mcp") {
          const mcpTarget = (parsed.flags.target as McpExportTarget) ?? "vscode";

          if (userLevel && write && !force) {
            console.error(formatError(
              "User-level writes require explicit confirmation",
              "Add --force to confirm: infrax export mcp --target claude-desktop --user --write --force"
            ));
            process.exit(1);
          }

          results = exportMcp(resolved, mcpTarget, {
            repoRoot,
            home: process.env.HOME ?? "",
            userLevel,
          });
        } else {
          // Load AGENTS.md content if configured
          const agentsMd = loadAgentsMdForExport(repoRoot, process.cwd());
          
          results = exportConfig(resolved, {
            repoRoot,
            targets: [target],
            agentsMdContent: agentsMd.content,
            agentsMdIncludeIn: agentsMd.includeIn,
          });
        }

        if (results.length === 0) {
          console.log(formatWarning("No items to export for this target."));
          break;
        }

        for (const result of results) {
          if (write) {
            const fullPath = result.isUserLevel
              ? result.filePath
              : path.join(repoRoot, result.filePath);

            ensureDirectory(fullPath);
            fs.writeFileSync(fullPath, result.content);
            console.log(formatSuccess(`Wrote ${fullPath}`));
          } else {
            console.log(`\n${colors.bold}--- ${result.filePath} ---${colors.reset}`);
            console.log(result.content);
          }
        }

        if (!write) {
          console.log(`\n${colors.dim}Add --write to write these files${colors.reset}`);
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
          console.log(`\n${colors.bold}=== Resolution Trace ===${colors.reset}\n`);

          console.log(`${colors.bold}Layers:${colors.reset}`);
          for (const layer of trace.layers) {
            const status = layer.enabled
              ? `${colors.green}enabled${colors.reset}`
              : `${colors.dim}disabled${colors.reset}`;
            console.log(`  ${layer.layer}: ${status}`);
            if (layer.enabled && Object.keys(layer.applied).length > 0) {
              const applied = layer.applied;
              if (applied.rules?.length) console.log(`    ${colors.dim}rules: ${applied.rules.join(", ")}${colors.reset}`);
              if (applied.agents?.length) console.log(`    ${colors.dim}agents: ${applied.agents.join(", ")}${colors.reset}`);
              if (applied.skills?.length) console.log(`    ${colors.dim}skills: ${applied.skills.join(", ")}${colors.reset}`);
              if (applied.mcpServers?.length) console.log(`    ${colors.dim}mcp: ${applied.mcpServers.join(", ")}${colors.reset}`);
            }
          }

          console.log(`\n${colors.bold}Activations:${colors.reset}`);
          for (const activation of trace.activations) {
            const status = activation.enabled
              ? `${colors.green}enabled${colors.reset}`
              : `${colors.dim}disabled${colors.reset}`;
            console.log(`  ${activation.id}: ${status}`);
            console.log(`    ${colors.dim}${activation.reason}${colors.reset}`);
          }

          if (trace.warnings.length > 0) {
            console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
            for (const warning of trace.warnings) {
              console.log(`  - ${warning}`);
            }
          }

          if (trace.errors.length > 0) {
            console.log(`\n${colors.red}Errors:${colors.reset}`);
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
          console.error(formatError("Configuration has errors:"));
          for (const err of resolved.trace.errors) {
            console.error(`  - ${err}`);
          }
        }

        if (hasWarnings) {
          for (const warning of resolved.trace.warnings) {
            console.log(formatWarning(warning));
          }
        }

        if (!hasErrors && !hasWarnings) {
          console.log(formatSuccess("Configuration is valid"));
          console.log(
            `  ${resolved.rules.length} rules, ${resolved.agents.length} agents, ${resolved.skills.length} skills, ${resolved.mcpServers.length} mcp servers`
          );
        }

        // Check exports if flag is set
        if (checkExportsFlag) {
          console.log(`\n${colors.bold}Checking exports...${colors.reset}`);

          const { matches, mismatches, missing } = checkExports(repoRoot, model, context);

          if (matches.length > 0) {
            for (const match of matches) {
              console.log(formatSuccess(`${match} is up to date`));
            }
          }

          if (missing.length > 0) {
            for (const file of missing) {
              console.log(formatWarning(`${file} is missing (run 'infrax export' to create)`));
            }
          }

          if (mismatches.length > 0) {
            for (const mismatch of mismatches) {
              console.error(formatError(`${mismatch.path}: ${mismatch.reason}`));
            }
          }

          if (mismatches.length > 0) {
            console.error(`\n${formatError("Exports are out of sync", "Run 'infrax export all --write' to update")}`);
            process.exit(1);
          }
        }

        process.exit(hasErrors ? 1 : 0);
        break;
      }

      case "drift": {
        console.log(`\n${colors.bold}Checking for drift...${colors.reset}\n`);
        showDrift(repoRoot, model, context);
        break;
      }

      default:
        console.error(formatError(
          `Unknown command: "${parsed.command}"`,
          "Run 'infrax help' for available commands"
        ));
        process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Provide helpful hints based on error type
    let hint: string | undefined;
    if (message.includes("No configuration file found")) {
      hint = "Run 'infrax init' to create a new configuration";
    } else if (message.includes("not found in registry")) {
      hint = "Check that the ID is correct and the file exists in ai/";
    } else if (message.includes("Failed to resolve preset")) {
      hint = "Make sure the preset package is installed: pnpm add <preset>";
    }

    console.error(formatError(message, hint));
    process.exit(1);
  }
}

main();
