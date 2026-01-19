import { resolveConfig } from "../../resolver/index.js";
import { formatError } from "./shared.js";
import { buildCliOverlayFromMcpFlags } from "./mcp-flags.js";

export function runResolve(args: {
  parsed: { flags: Record<string, unknown> };
  repoRoot: string;
  model?: string;
  context?: string;
}): void {
  const overlayResult = buildCliOverlayFromMcpFlags(args.parsed);
  if (!overlayResult.ok) {
    console.error(formatError(overlayResult.error));
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

  console.log(JSON.stringify(resolved, null, 2));
}
