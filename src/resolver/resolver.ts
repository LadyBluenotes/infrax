import type {
  Registry,
  RootConfig,
  ResolveInput,
  ResolvedConfig,
  ResolutionTrace,
  EnableDisableSet,
  ContextId,
  ModelId,
  RuleDefinition,
  AgentDefinition,
  SkillDefinition,
  McpServerDefinition,
  Selectors,
  LayerTraceEntry,
} from "../types/index.js";
import { matchPattern, simpleHash } from "../utils/index.js";
import { loadRootConfig, loadFullRegistry } from "../loaders/index.js";

/**
 * Check if selectors match the current model/context.
 */
function selectorsMatch(
  selectors: Selectors | undefined,
  model: ModelId | undefined,
  context: ContextId | undefined
): boolean {
  if (!selectors) return true;

  // Check model selectors
  if (selectors.models && selectors.models.length > 0 && model) {
    const modelMatches = selectors.models.some((pattern) =>
      matchPattern(pattern, model)
    );
    if (!modelMatches) return false;
  }

  // Check context selectors
  if (selectors.contexts && selectors.contexts.length > 0 && context) {
    if (!selectors.contexts.includes(context)) return false;
  }

  return true;
}

/**
 * Apply instruction variants to an agent based on selected model.
 */
function applyInstructionVariants(
  agent: AgentDefinition,
  model: ModelId | undefined
): AgentDefinition {
  if (!agent.variants || !model) return agent;

  let instructions = agent.instructions ?? "";

  for (const variant of agent.variants) {
    let matches = false;

    if (variant.when.model && matchPattern(variant.when.model, model)) {
      matches = true;
    }
    if (variant.when.modelFamily && matchPattern(variant.when.modelFamily, model)) {
      matches = true;
    }

    if (matches) {
      if (variant.replace) {
        instructions = variant.replace;
      } else {
        if (variant.prepend) {
          instructions = variant.prepend + "\n\n" + instructions;
        }
        if (variant.append) {
          instructions = instructions + "\n\n" + variant.append;
        }
      }
    }
  }

  return {
    ...agent,
    instructions,
  };
}

/**
 * Resolve configuration from registry based on input.
 */
export function resolveFromRegistry(
  registry: Registry,
  rootConfig: RootConfig,
  input: ResolveInput
): ResolvedConfig {
  const trace: ResolutionTrace = {
    presets: [],
    layers: [],
    activations: [],
    warnings: [],
    errors: [],
  };

  const { model, context, cliOverlay } = input;

  // Track what's enabled/disabled
  const enabled: EnableDisableSet = {
    rules: [],
    agents: [],
    skills: [],
    mcpServers: [],
  };
  const disabled: EnableDisableSet = {
    rules: [],
    agents: [],
    skills: [],
    mcpServers: [],
  };

  // Helper to add layer trace
  const addLayerTrace = (
    layer: LayerTraceEntry["layer"],
    isEnabled: boolean,
    applied: EnableDisableSet
  ) => {
    trace.layers.push({ layer, enabled: isEnabled, applied });
  };

  // 1. Base layer (from root config)
  const baseEnabled = rootConfig.layers?.base?.enabled ?? true;
  if (baseEnabled) {
    const baseEnable = rootConfig.enable ?? {};
    const baseDisable = rootConfig.disable ?? {};

    enabled.rules?.push(...(baseEnable.rules ?? []));
    enabled.agents?.push(...(baseEnable.agents ?? []));
    enabled.skills?.push(...(baseEnable.skills ?? []));
    enabled.mcpServers?.push(...(baseEnable.mcpServers ?? []));

    disabled.rules?.push(...(baseDisable.rules ?? []));
    disabled.agents?.push(...(baseDisable.agents ?? []));
    disabled.skills?.push(...(baseDisable.skills ?? []));
    disabled.mcpServers?.push(...(baseDisable.mcpServers ?? []));

    addLayerTrace("base", true, baseEnable);
  } else {
    addLayerTrace("base", false, {});
  }

  // 2. Context layer
  const contextEnabled = rootConfig.layers?.context?.enabled ?? true;
  if (contextEnabled && context) {
    const contextDef = registry.contexts.get(context);
    if (contextDef) {
      const contextEnable = contextDef.enable ?? {};
      const contextDisable = contextDef.disable ?? {};

      enabled.rules?.push(...(contextEnable.rules ?? []));
      enabled.agents?.push(...(contextEnable.agents ?? []));
      enabled.skills?.push(...(contextEnable.skills ?? []));
      enabled.mcpServers?.push(...(contextEnable.mcpServers ?? []));

      disabled.rules?.push(...(contextDisable.rules ?? []));
      disabled.agents?.push(...(contextDisable.agents ?? []));
      disabled.skills?.push(...(contextDisable.skills ?? []));
      disabled.mcpServers?.push(...(contextDisable.mcpServers ?? []));

      addLayerTrace("context", true, contextEnable);
    } else {
      trace.warnings.push(`Context "${context}" not found in registry`);
      addLayerTrace("context", false, {});
    }
  } else {
    addLayerTrace("context", false, {});
  }

  // 3. Model layer
  const modelEnabled = rootConfig.layers?.model?.enabled ?? true;
  if (modelEnabled && model) {
    const modelDef = registry.models.get(model);
    if (modelDef) {
      const modelEnable = modelDef.enable ?? {};
      const modelDisable = modelDef.disable ?? {};

      enabled.rules?.push(...(modelEnable.rules ?? []));
      enabled.agents?.push(...(modelEnable.agents ?? []));
      enabled.skills?.push(...(modelEnable.skills ?? []));
      enabled.mcpServers?.push(...(modelEnable.mcpServers ?? []));

      disabled.rules?.push(...(modelDisable.rules ?? []));
      disabled.agents?.push(...(modelDisable.agents ?? []));
      disabled.skills?.push(...(modelDisable.skills ?? []));
      disabled.mcpServers?.push(...(modelDisable.mcpServers ?? []));

      addLayerTrace("model", true, modelEnable);
    } else {
      // Model not found in registry is OK (just means no model-specific overrides)
      addLayerTrace("model", false, {});
    }
  } else {
    addLayerTrace("model", false, {});
  }

  // 4. CLI layer
  const cliEnabled = rootConfig.layers?.cli?.enabled ?? true;
  if (cliEnabled && cliOverlay) {
    const cliEnable = cliOverlay.enable ?? {};
    const cliDisable = cliOverlay.disable ?? {};

    enabled.rules?.push(...(cliEnable.rules ?? []));
    enabled.agents?.push(...(cliEnable.agents ?? []));
    enabled.skills?.push(...(cliEnable.skills ?? []));
    enabled.mcpServers?.push(...(cliEnable.mcpServers ?? []));

    disabled.rules?.push(...(cliDisable.rules ?? []));
    disabled.agents?.push(...(cliDisable.agents ?? []));
    disabled.skills?.push(...(cliDisable.skills ?? []));
    disabled.mcpServers?.push(...(cliDisable.mcpServers ?? []));

    addLayerTrace("cli", true, cliEnable);
  } else {
    addLayerTrace("cli", false, {});
  }

  // Dedupe and compute final sets
  const enabledRules = new Set(enabled.rules);
  const enabledAgents = new Set(enabled.agents);
  const enabledSkills = new Set(enabled.skills);
  const enabledMcpServers = new Set(enabled.mcpServers);

  const disabledRules = new Set(disabled.rules);
  const disabledAgents = new Set(disabled.agents);
  const disabledSkills = new Set(disabled.skills);
  const disabledMcpServers = new Set(disabled.mcpServers);

  // Remove disabled items from enabled sets
  for (const id of disabledRules) enabledRules.delete(id);
  for (const id of disabledAgents) enabledAgents.delete(id);
  for (const id of disabledSkills) enabledSkills.delete(id);
  for (const id of disabledMcpServers) enabledMcpServers.delete(id);

  // 5. Compute dependency closure

  // Agents pull in their rules and skills
  for (const agentId of enabledAgents) {
    const agent = registry.agents.get(agentId);
    if (agent) {
      for (const ruleId of agent.rules ?? []) {
        if (!disabledRules.has(ruleId)) {
          enabledRules.add(ruleId);
        }
      }
      for (const skillId of agent.skills ?? []) {
        if (!disabledSkills.has(skillId)) {
          enabledSkills.add(skillId);
        }
      }
      for (const mcpId of agent.mcpServers ?? []) {
        if (!disabledMcpServers.has(mcpId)) {
          enabledMcpServers.add(mcpId);
        }
      }
    }
  }

  // Skills pull in their required MCP servers
  for (const skillId of enabledSkills) {
    const skill = registry.skills.get(skillId);
    if (skill) {
      for (const mcpId of skill.requiresMcpServers ?? []) {
        if (!disabledMcpServers.has(mcpId)) {
          enabledMcpServers.add(mcpId);
        }
      }
    }
  }

  // 6. Validate selectors and collect active items
  const activeRules: RuleDefinition[] = [];
  const activeAgents: AgentDefinition[] = [];
  const activeSkills: SkillDefinition[] = [];
  const activeMcpServers: McpServerDefinition[] = [];

  const allowMissingDeps = rootConfig.policy?.allowMissingDependencies ?? false;

  // Collect rules
  for (const ruleId of enabledRules) {
    const rule = registry.rules.get(ruleId);
    if (!rule) {
      if (!allowMissingDeps) {
        trace.errors.push(`Rule "${ruleId}" not found in registry`);
      }
      continue;
    }

    if (!selectorsMatch(rule.selectors, model, context)) {
      trace.warnings.push(
        `Rule "${ruleId}" skipped: selectors don't match model/context`
      );
      continue;
    }

    activeRules.push(rule);
    trace.activations.push({
      id: ruleId,
      enabled: true,
      reason: "explicitly enabled or via dependency",
      source: rule.source,
    });
  }

  // Collect agents
  for (const agentId of enabledAgents) {
    const agent = registry.agents.get(agentId);
    if (!agent) {
      if (!allowMissingDeps) {
        trace.errors.push(`Agent "${agentId}" not found in registry`);
      }
      continue;
    }

    if (!selectorsMatch(agent.selectors, model, context)) {
      trace.warnings.push(
        `Agent "${agentId}" skipped: selectors don't match model/context`
      );
      continue;
    }

    // Apply instruction variants
    const resolvedAgent = applyInstructionVariants(agent, model);
    activeAgents.push(resolvedAgent);
    trace.activations.push({
      id: agentId,
      enabled: true,
      reason: "explicitly enabled",
      source: agent.source,
    });
  }

  // Collect skills
  for (const skillId of enabledSkills) {
    const skill = registry.skills.get(skillId);
    if (!skill) {
      if (!allowMissingDeps) {
        trace.errors.push(`Skill "${skillId}" not found in registry`);
      }
      continue;
    }

    if (!selectorsMatch(skill.selectors, model, context)) {
      trace.warnings.push(
        `Skill "${skillId}" skipped: selectors don't match model/context`
      );
      continue;
    }

    activeSkills.push(skill);
    trace.activations.push({
      id: skillId,
      enabled: true,
      reason: "explicitly enabled or via agent dependency",
      source: skill.source,
    });
  }

  // Collect MCP servers
  for (const mcpId of enabledMcpServers) {
    const mcp = registry.mcpServers.get(mcpId);
    if (!mcp) {
      if (!allowMissingDeps) {
        trace.errors.push(`MCP server "${mcpId}" not found in registry`);
      }
      continue;
    }

    if (!selectorsMatch(mcp.selectors, model, context)) {
      trace.warnings.push(
        `MCP server "${mcpId}" skipped: selectors don't match model/context`
      );
      continue;
    }

    activeMcpServers.push(mcp);
    trace.activations.push({
      id: mcpId,
      enabled: true,
      reason: "explicitly enabled or via skill dependency",
      source: mcp.source,
    });
  }

  // Compute config hash
  const configData = JSON.stringify({
    rules: activeRules.map((r) => r.id),
    agents: activeAgents.map((a) => a.id),
    skills: activeSkills.map((s) => s.id),
    mcpServers: activeMcpServers.map((m) => m.id),
    model,
    context,
  });
  const configHash = simpleHash(configData);

  return {
    rules: activeRules,
    agents: activeAgents,
    skills: activeSkills,
    mcpServers: activeMcpServers,
    meta: {
      version: 1,
      model,
      context,
      timestamp: new Date().toISOString(),
      configHash,
    },
    trace,
  };
}

/**
 * Main resolve function - loads config, builds registry, and resolves.
 */
export function resolveConfig(input: ResolveInput): ResolvedConfig {
  const rootConfig = loadRootConfig(input.repoRoot);
  const { registry, errors } = loadFullRegistry(input.repoRoot, rootConfig);

  // Start resolution
  const resolved = resolveFromRegistry(registry, rootConfig, input);

  // Add loading errors to trace
  resolved.trace.errors.push(...errors);

  return resolved;
}

/**
 * Explain resolution (returns just the trace with more detail).
 */
export function explainResolution(input: ResolveInput): ResolutionTrace {
  const resolved = resolveConfig(input);
  return resolved.trace;
}
