import type { McpCatalogEntry } from "../../mcp/catalog.js";
import { getMcpCatalogEntries } from "../../mcp/catalog.js";
import { resolveConfig } from "../../resolver/index.js";
import { loadFullRegistry, loadRootConfig } from "../../loaders/index.js";
import { colors, formatError, formatWarning } from "./shared.js";

export function runList(args: {
  repoRoot: string;
  model?: string;
  context?: string;
  type?: string;
  all: boolean;
  json: boolean;
  catalog: boolean;
}): void {
  if (args.type === "mcp" && args.catalog) {
    const entries = getMcpCatalogEntries();
    printMcpCatalog(entries, args.json);
    return;
  }

  const type = args.type;
  if (!type || !["rules", "agents", "skills", "mcp"].includes(type)) {
    console.error(
      formatError(
        "Invalid list type",
        "Usage: infrax list <rules|agents|skills|mcp>"
      )
    );
    process.exit(1);
  }

  const rootConfig = loadRootConfig(args.repoRoot);
  const { registry, errors } = loadFullRegistry(args.repoRoot, rootConfig);

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(formatWarning(err));
    }
  }

  const resolved = resolveConfig({
    repoRoot: args.repoRoot,
    model: args.model,
    context: args.context as `context:${string}` | undefined,
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

  if (!args.all) {
    items = items.filter((item) => activeIds.has(item.id));
  }

  if (args.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  console.log(
    `\n${colors.bold}${type.toUpperCase()}${colors.reset} (${args.all ? "all" : "active"}):\n`
  );

  if (items.length === 0) {
    console.log(`  ${colors.dim}No items found${colors.reset}`);
  } else {
    for (const item of items) {
      const status = activeIds.has(item.id)
        ? `${colors.green}[active]${colors.reset}`
        : `${colors.dim}[inactive]${colors.reset}`;
      const source = item.source
        ? `${colors.dim}(${item.source})${colors.reset}`
        : "";
      console.log(`  ${item.id} ${status} ${source}`);
    }
  }

  console.log("");
}

function printMcpCatalog(entries: McpCatalogEntry[], json: boolean) {
  if (json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  console.log(`\n${colors.bold}MCP CATALOG${colors.reset}\n`);
  for (const entry of entries) {
    console.log(`  ${entry.alias} ${colors.dim}-> ${entry.id}${colors.reset}`);
    console.log(`    ${colors.dim}${entry.description}${colors.reset}`);
  }
  console.log("");
}
