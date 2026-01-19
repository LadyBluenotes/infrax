import type { ConfigDefinition, Conflict } from "../types/index.js";

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  conflicts: Conflict[];
};

export function validateConfig(config: ConfigDefinition): ValidationResult {
  const errors: string[] = [];
  const conflicts: Conflict[] = [];

  const seenRules = new Set<string>();
  for (const rule of config.rules ?? []) {
    if (seenRules.has(rule.id)) {
      conflicts.push({
        type: "rule",
        id: rule.id,
        scope: "project",
        message: `Duplicate rule id ${rule.id}`,
      });
    }
    seenRules.add(rule.id);
  }

  const seenSkills = new Set<string>();
  for (const skill of config.skills ?? []) {
    if (seenSkills.has(skill.id)) {
      conflicts.push({
        type: "skill",
        id: skill.id,
        scope: "project",
        message: `Duplicate skill id ${skill.id}`,
      });
    }
    seenSkills.add(skill.id);
  }

  const seenMcp = new Set<string>();
  for (const mcp of config.mcpServers ?? []) {
    if (seenMcp.has(mcp.id)) {
      conflicts.push({
        type: "mcp",
        id: mcp.id,
        scope: "project",
        message: `Duplicate MCP id ${mcp.id}`,
      });
    }
    seenMcp.add(mcp.id);
  }

  const seenAgents = new Set<string>();
  for (const agent of config.agents ?? []) {
    if (seenAgents.has(agent.id)) {
      conflicts.push({
        type: "agent",
        id: agent.id,
        scope: "project",
        message: `Duplicate agent id ${agent.id}`,
      });
    }
    seenAgents.add(agent.id);
  }

  return {
    ok: errors.length === 0 && conflicts.length === 0,
    errors,
    conflicts,
  };
}
