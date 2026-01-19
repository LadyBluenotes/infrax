import type { ConfigAgent, ConfigDefinition, ConfigMcpServer, ConfigRule, ConfigSkill } from "../types/index.js";

export type ConfigItemType = "framework" | "rule" | "skill" | "mcp-server" | "agent";

export function addConfigItem(
  config: ConfigDefinition,
  type: ConfigItemType,
  id: string
): ConfigDefinition {
  if (type === "framework") {
    const frameworks = new Set(config.project?.context?.frameworks ?? []);
    frameworks.add(id);
    return {
      ...config,
      project: {
        ...(config.project ?? {}),
        context: {
          ...(config.project?.context ?? {}),
          frameworks: Array.from(frameworks.values()).sort(),
        },
      },
    };
  }

  if (type === "rule") {
    return {
      ...config,
      rules: mergeItem(config.rules, { id, enabled: true } as ConfigRule),
    };
  }

  if (type === "skill") {
    return {
      ...config,
      skills: mergeItem(config.skills, { id, enabled: true } as ConfigSkill),
    };
  }

  if (type === "mcp-server") {
    return {
      ...config,
      mcpServers: mergeItem(config.mcpServers, { id, enabled: true } as ConfigMcpServer),
    };
  }

  return {
    ...config,
    agents: mergeItem(config.agents, { id } as ConfigAgent),
  };
}

export function toggleItem(
  config: ConfigDefinition,
  type: Exclude<ConfigItemType, "framework">,
  id: string,
  enabled: boolean
): ConfigDefinition {
  const update = <T extends { id: string; enabled?: boolean }>(items: T[] | undefined): T[] => {
    const next = mergeItem(items, { id, enabled } as T);
    return next.map((item) => (item.id === id ? { ...item, enabled } : item));
  };

  if (type === "rule") {
    return { ...config, rules: update(config.rules) };
  }

  if (type === "skill") {
    return { ...config, skills: update(config.skills) };
  }

  if (type === "mcp-server") {
    return { ...config, mcpServers: update(config.mcpServers) };
  }

  return { ...config, agents: update(config.agents) };
}

function mergeItem<T extends { id: string }>(items: T[] | undefined, item: T): T[] {
  const map = new Map<string, T>();
  for (const entry of items ?? []) {
    map.set(entry.id, entry);
  }
  map.set(item.id, { ...map.get(item.id), ...item });
  return Array.from(map.values());
}
