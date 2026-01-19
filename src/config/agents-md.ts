import * as fs from "node:fs";
import * as path from "node:path";
import type { ConfigDefinition } from "../types/index.js";

const START_MARKER = "<!-- infrax:start -->";
const END_MARKER = "<!-- infrax:end -->";

export function renderAgentsMdBlock(config: ConfigDefinition): string {
  const lines: string[] = [];
  lines.push(START_MARKER);
  lines.push("# infrax agents");
  lines.push("");

  if (config.project?.context) {
    const context = config.project.context;
    lines.push("## Context");
    if (context.frameworks?.length) {
      lines.push(`- frameworks: ${context.frameworks.join(", ")}`);
    }
    if (context.languages?.length) {
      lines.push(`- languages: ${context.languages.join(", ")}`);
    }
    if (context.model) {
      lines.push(`- model: ${context.model}`);
    }
    lines.push("");
  }

  if (config.mcpServers?.length) {
    lines.push("## MCP Servers");
    for (const server of config.mcpServers) {
      const status = server.enabled === false ? "disabled" : "enabled";
      lines.push(`- ${server.id} (${status})`);
    }
    lines.push("");
  }

  if (config.rules?.length) {
    lines.push("## Rules");
    for (const rule of config.rules) {
      const status = rule.enabled === false ? "disabled" : "enabled";
      lines.push(`- ${rule.id} (${status})`);
    }
    lines.push("");
  }

  if (config.skills?.length) {
    lines.push("## Skills");
    for (const skill of config.skills) {
      const status = skill.enabled === false ? "disabled" : "enabled";
      lines.push(`- ${skill.id} (${status})`);
    }
    lines.push("");
  }

  if (config.agents?.length) {
    lines.push("## Agents");
    for (const agent of config.agents) {
      const model = agent.model ? ` - model: ${agent.model}` : "";
      lines.push(`- ${agent.id}${model}`);
      if (agent.rules?.length) {
        lines.push(`  - rules: ${agent.rules.join(", ")}`);
      }
      if (agent.skills?.length) {
        lines.push(`  - skills: ${agent.skills.join(", ")}`);
      }
    }
    lines.push("");
  }

  lines.push(END_MARKER);
  return lines.join("\n");
}

export function updateAgentsMdFile(
  filePath: string,
  config: ConfigDefinition
): { updated: boolean; content: string } {
  const nextBlock = renderAgentsMdBlock(config);
  if (!filePath) {
    return { updated: true, content: nextBlock + "\n" };
  }
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";

  if (!existing) {
    return { updated: true, content: nextBlock + "\n" };
  }

  const startIndex = existing.indexOf(START_MARKER);
  const endIndex = existing.indexOf(END_MARKER);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = existing.slice(0, startIndex).trimEnd();
    const after = existing.slice(endIndex + END_MARKER.length).trimStart();
    const combined = [before, nextBlock, after]
      .filter((section) => section.length > 0)
      .join("\n\n");
    return { updated: combined.trimEnd() !== existing.trimEnd(), content: combined + "\n" };
  }

  const appended = `${existing.trimEnd()}\n\n${nextBlock}\n`;
  return { updated: appended.trimEnd() !== existing.trimEnd(), content: appended };
}

export function resolveAgentsMdPath(repoRoot: string): string {
  return path.join(repoRoot, "AGENTS.md");
}
