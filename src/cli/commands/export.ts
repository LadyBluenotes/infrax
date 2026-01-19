import * as fs from "node:fs";
import * as path from "node:path";
import type { ExportResult, ExportTarget, McpExportTarget } from "../../types/index.js";
import { resolveConfig } from "../../resolver/index.js";
import { exportConfig, exportMcp } from "../../exporters/index.js";
import { loadFullRegistry, loadRootConfig } from "../../loaders/index.js";
import { MCP_CATALOG } from "../../mcp/catalog.js";
import { loadAgentsMdForExport } from "./agents-md.js";
import { buildCliOverlayFromMcpFlags } from "./mcp-flags.js";
import { ensureDirectory, formatError, formatSuccess, formatWarning, colors } from "./shared.js";
import { generateAllExports } from "./exports.js";

function sketchMcpServer(repoRoot: string, alias: string): string {
  const entry = MCP_CATALOG[alias];
  const filePath = path.join(repoRoot, "ai", "mcp", `${alias}.jsonc`);
  ensureDirectory(filePath);
  fs.writeFileSync(filePath, JSON.stringify(entry.template, null, 2));
  return filePath;
}

export function runExport(args: {
  target?: string;
  parsed: { flags: Record<string, unknown> };
  repoRoot: string;
  model?: string;
  context?: string;
  write: boolean;
  userLevel: boolean;
  force: boolean;
}): void {
  const target = args.target as ExportTarget | "mcp" | "all" | undefined;

  const overlayResult = buildCliOverlayFromMcpFlags(args.parsed);
  if (!overlayResult.ok) {
    console.error(formatError(overlayResult.error));
    process.exit(1);
  }

  const requestedAliases = overlayResult.requestedAliases;

  // If MCP aliases were requested and we're writing, scaffold missing definitions into ai/mcp/.
  if (args.write && requestedAliases.length > 0) {
    const rootConfig = loadRootConfig(args.repoRoot);
    const { registry } = loadFullRegistry(args.repoRoot, rootConfig);

    for (const alias of requestedAliases) {
      const id = MCP_CATALOG[alias]?.id;
      if (!id) continue;
      if (!registry.mcpServers.has(id)) {
        const createdPath = sketchMcpServer(args.repoRoot, alias);
        console.log(formatSuccess(`Created ${createdPath}`));
      }
    }
  }

  if (!target || !["cursor", "copilot", "claude", "mcp", "all"].includes(target)) {
    console.error(
      formatError(
        "Invalid export target",
        "Usage: infrax export <cursor|copilot|claude|mcp|all> [--write]"
      )
    );
    process.exit(1);
  }

  const resolved = resolveConfig({
    repoRoot: args.repoRoot,
    model: args.model,
    context: args.context as `context:${string}` | undefined,
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
    results = generateAllExports(args.repoRoot, args.model, args.context);
  } else if (target === "mcp") {
    const mcpTarget = (args.parsed.flags.target as McpExportTarget) ?? "vscode";

    if (args.userLevel && args.write && !args.force) {
      console.error(
        formatError(
          "User-level writes require explicit confirmation",
          "Add --force to confirm: infrax export mcp --target claude-desktop --user --write --force"
        )
      );
      process.exit(1);
    }

    results = exportMcp(resolved, mcpTarget, {
      repoRoot: args.repoRoot,
      home: process.env.HOME ?? "",
      userLevel: args.userLevel,
    });
  } else {
    // Load AGENTS.md content if configured
    const agentsMd = loadAgentsMdForExport(args.repoRoot, process.cwd());

    results = exportConfig(resolved, {
      repoRoot: args.repoRoot,
      targets: [target],
      agentsMdContent: agentsMd.content,
      agentsMdIncludeIn: agentsMd.includeIn,
    });
  }

  if (results.length === 0) {
    console.log(formatWarning("No items to export for this target."));
    return;
  }

  for (const result of results) {
    if (args.write) {
      const fullPath = result.isUserLevel
        ? result.filePath
        : path.join(args.repoRoot, result.filePath);

      ensureDirectory(fullPath);
      fs.writeFileSync(fullPath, result.content);
      console.log(formatSuccess(`Wrote ${fullPath}`));
    } else {
      console.log(`\n${colors.bold}--- ${result.filePath} ---${colors.reset}`);
      console.log(result.content);
    }
  }

  if (!args.write) {
    console.log(`\n${colors.dim}Add --write to write these files${colors.reset}`);
  }
}
