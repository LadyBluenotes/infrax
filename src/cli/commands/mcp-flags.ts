import type { EnableDisableSet, McpServerId } from "../../types/index.js";
import { parseMcpFlagValues, resolveMcpRef } from "../../mcp/catalog.js";

export function buildCliOverlayFromMcpFlags(parsed: {
  flags: Record<string, unknown>;
}):
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
