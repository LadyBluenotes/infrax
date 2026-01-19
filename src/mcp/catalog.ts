import type { McpServerDefinition, McpServerId } from "../types/index.js";

export interface McpCatalogEntry {
  alias: string;
  id: McpServerId;
  description: string;
  template: Omit<McpServerDefinition, "source">;
}

export const MCP_CATALOG: Record<string, McpCatalogEntry> = {
  filesystem: {
    alias: "filesystem",
    id: "mcp:filesystem",
    description: "Local filesystem access (official MCP server)",
    template: {
      id: "mcp:filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "${repoRoot}"],
      env: {},
    },
  },
  github: {
    alias: "github",
    id: "mcp:github",
    description: "GitHub API access (official MCP server)",
    template: {
      id: "mcp:github",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_TOKEN: "${GITHUB_TOKEN}",
      },
    },
  },
};

export function normalizeMcpAlias(input: string): string {
  return input.trim().toLowerCase();
}

export function parseMcpFlagValues(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      out.push(...parseMcpFlagValues(item));
    }
    return out;
  }

  return [];
}

export function resolveMcpRef(ref: string):
  | { ok: true; id: McpServerId; alias?: string }
  | { ok: false; error: string } {
  const trimmed = ref.trim();
  if (!trimmed) return { ok: false, error: "Empty MCP reference" };

  if (trimmed.startsWith("mcp:")) {
    return { ok: true, id: trimmed as McpServerId };
  }

  const alias = normalizeMcpAlias(trimmed);
  const entry = MCP_CATALOG[alias];
  if (!entry) {
    const known = Object.keys(MCP_CATALOG).sort();
    return {
      ok: false,
      error: `Unknown MCP alias "${trimmed}". Known: ${known.join(", ")}`,
    };
  }

  return { ok: true, id: entry.id, alias };
}

export function getMcpCatalogEntries(): McpCatalogEntry[] {
  return Object.values(MCP_CATALOG).sort((a, b) => a.alias.localeCompare(b.alias));
}
