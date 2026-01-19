import { importAgentsMd } from "../../loaders/agents-md.js";
import { loadRootConfig } from "../../loaders/index.js";

export function loadAgentsMdForExport(
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
