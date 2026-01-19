import type {
  ConfigAgent,
  ConfigDefinition,
  ConfigMcpServer,
  ConfigRule,
  ConfigSkill,
  Conflict,
  MergeResult,
  ScopeLevel,
} from "../types/index.js";

function toMap<T extends { id: string }>(items: T[] | undefined): Map<string, T> {
  return new Map((items ?? []).map((item) => [item.id, item]));
}

function mergeById<T extends { id: string }>(
  globalItems: T[] | undefined,
  projectItems: T[] | undefined,
  type: Conflict["type"],
  conflicts: Conflict[]
): T[] {
  const merged = new Map<string, T>();
  const globalMap = toMap(globalItems);
  const projectMap = toMap(projectItems);

  for (const [id, item] of globalMap) {
    merged.set(id, item);
  }

  for (const [id, item] of projectMap) {
    if (merged.has(id)) {
      conflicts.push({
        type,
        id,
        scope: "project",
        message: `Conflict for ${type} "${id}" between global and project config`,
        resolution: "prefer-local",
      });
    }
    merged.set(id, item);
  }

  return Array.from(merged.values());
}

function mergeProjectInfo(
  globalConfig: ConfigDefinition,
  projectConfig: ConfigDefinition
): ConfigDefinition["project"] {
  const globalProject = globalConfig.project ?? {};
  const projectProject = projectConfig.project ?? {};

  return {
    name: projectProject.name ?? globalProject.name,
    root: projectProject.root ?? globalProject.root,
    context: {
      frameworks:
        projectProject.context?.frameworks ?? globalProject.context?.frameworks,
      languages:
        projectProject.context?.languages ?? globalProject.context?.languages,
      model: projectProject.context?.model ?? globalProject.context?.model,
    },
  };
}

type WithScope<T> = T & { scope?: ScopeLevel };

type ScopedItem = ConfigRule | ConfigSkill | ConfigMcpServer | ConfigAgent;

type NormalizeResult<T> = WithScope<T>;

function normalizeScope<T extends ScopedItem>(
  items: T[] | undefined,
  scope: ScopeLevel
): Array<NormalizeResult<T>> {
  return (items ?? []).map((item) => ({
    ...item,
    scope: (item as WithScope<T>).scope ?? scope,
  })) as Array<NormalizeResult<T>>;
}

export function mergeConfigs(
  globalConfig: ConfigDefinition,
  projectConfig: ConfigDefinition
): MergeResult {
  const conflicts: Conflict[] = [];

  const merged: ConfigDefinition = {
    version: 1,
    project: mergeProjectInfo(globalConfig, projectConfig),
    rules: mergeById(
      normalizeScope(globalConfig.rules, "global"),
      normalizeScope(projectConfig.rules, "project"),
      "rule",
      conflicts
    ),
    skills: mergeById(
      normalizeScope(globalConfig.skills, "global"),
      normalizeScope(projectConfig.skills, "project"),
      "skill",
      conflicts
    ),
    mcpServers: mergeById(
      normalizeScope(globalConfig.mcpServers, "global"),
      normalizeScope(projectConfig.mcpServers, "project"),
      "mcp",
      conflicts
    ),
    agents: mergeById(
      normalizeScope(globalConfig.agents, "global"),
      normalizeScope(projectConfig.agents, "project"),
      "agent",
      conflicts
    ),
  };

  return {
    mergedConfig: merged,
    conflicts,
    warnings: [],
  };
}
