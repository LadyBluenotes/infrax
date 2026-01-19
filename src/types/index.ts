/**
 * Core type definitions for the infrax configuration system.
 */

// -----------------------------------------------------------------------------
// Identifiers
// -----------------------------------------------------------------------------

export type RuleId = `rule:${string}`;
export type AgentId = `agent:${string}`;
export type SkillId = `skill:${string}`;
export type McpServerId = `mcp:${string}`;
export type ContextId = `context:${string}`;
export type ModelId = string; // e.g., "anthropic:claude-3.5-sonnet", "openai:gpt-4.1"
export type PresetId = `preset:${string}`;

// -----------------------------------------------------------------------------
// Selectors (for model/context gating)
// -----------------------------------------------------------------------------

export interface Selectors {
  /** Model patterns (glob-like, e.g., "anthropic:*", "openai:gpt-4*") */
  models?: string[];
  /** Context ids this item applies to */
  contexts?: ContextId[];
}

// -----------------------------------------------------------------------------
// Rule (portable instruction unit)
// -----------------------------------------------------------------------------

export interface RuleDefinition {
  id: RuleId;
  /** Markdown content */
  content: string;
  /** Which export targets this rule applies to */
  targets?: ExportTarget[];
  /** Model/context selectors */
  selectors?: Selectors;
  /** Path scopes (for Copilot-style path-specific rules) */
  scope?: {
    paths?: string[];
  };
  /** Override a rule from a preset */
  override?: boolean;
  /** Source provenance */
  source?: SourceInfo;
}

// -----------------------------------------------------------------------------
// Agent
// -----------------------------------------------------------------------------

export interface AgentDefinition {
  id: AgentId;
  /** Base instructions */
  instructions?: string;
  /** Instruction variants per model */
  variants?: InstructionVariant[];
  /** Rules this agent includes */
  rules?: RuleId[];
  /** Skills this agent uses */
  skills?: SkillId[];
  /** MCP servers this agent requires directly */
  mcpServers?: McpServerId[];
  /** Selectors */
  selectors?: Selectors;
  /** Override an agent from a preset */
  override?: boolean;
  /** Source provenance */
  source?: SourceInfo;
}

export interface InstructionVariant {
  when: {
    model?: string;
    modelFamily?: string;
  };
  /** Content to append */
  append?: string;
  /** Content to prepend */
  prepend?: string;
  /** Content to replace (full replacement) */
  replace?: string;
}

// -----------------------------------------------------------------------------
// Skill
// -----------------------------------------------------------------------------

export type SkillGrant =
  | "fs:read"
  | "fs:write"
  | "net"
  | "shell"
  | `mcp:${string}`
  | string;

export interface SkillDefinition {
  id: SkillId;
  /** Capabilities this skill grants */
  grants: SkillGrant[];
  /** MCP servers required by this skill */
  requiresMcpServers?: McpServerId[];
  /** Selectors */
  selectors?: Selectors;
  /** Override a skill from a preset */
  override?: boolean;
  /** Source provenance */
  source?: SourceInfo;
}

// -----------------------------------------------------------------------------
// MCP Server
// -----------------------------------------------------------------------------

export type McpTransport = "stdio" | "http";

export interface McpServerDefinition {
  id: McpServerId;
  transport: McpTransport;
  /** For stdio transport */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  /** For http transport */
  url?: string;
  headers?: Record<string, string>;
  /** Selectors */
  selectors?: Selectors;
  /** Override an MCP server from a preset */
  override?: boolean;
  /** Source provenance */
  source?: SourceInfo;
}

// -----------------------------------------------------------------------------
// Context (project profile)
// -----------------------------------------------------------------------------

export interface ContextDefinition {
  id: ContextId;
  /** Description */
  description?: string;
  enable?: EnableDisableSet;
  disable?: EnableDisableSet;
  /** Overrides to apply when this context is active */
  overrides?: {
    rules?: Partial<RuleDefinition>[];
    agents?: Partial<AgentDefinition>[];
  };
  /** Source provenance */
  source?: SourceInfo;
}

// -----------------------------------------------------------------------------
// Model profile
// -----------------------------------------------------------------------------

export interface ModelDefinition {
  id: ModelId;
  /** Description */
  description?: string;
  enable?: EnableDisableSet;
  disable?: EnableDisableSet;
  /** Overrides to apply when this model is selected */
  overrides?: {
    rules?: Partial<RuleDefinition>[];
    agents?: Partial<AgentDefinition>[];
  };
  /** Source provenance */
  source?: SourceInfo;
}

// -----------------------------------------------------------------------------
// Enable/Disable sets
// -----------------------------------------------------------------------------

export interface EnableDisableSet {
  rules?: RuleId[];
  agents?: AgentId[];
  skills?: SkillId[];
  mcpServers?: McpServerId[];
}

// -----------------------------------------------------------------------------
// Preset
// -----------------------------------------------------------------------------

export interface PresetManifest {
  presetVersion: 1;
  id: PresetId;
  include?: {
    rulesDir?: string;
    agentsDir?: string;
    skillsDir?: string;
    mcpDir?: string;
    contextsDir?: string;
    modelsDir?: string;
  };
  defaults?: {
    enable?: EnableDisableSet;
    disable?: EnableDisableSet;
  };
}

// -----------------------------------------------------------------------------
// Root config (ai.config.jsonc)
// -----------------------------------------------------------------------------

export interface RootConfig {
  version: 1;
  /** Presets to extend (npm or local paths) */
  extends?: string[];
  /** Directory includes */
  include?: {
    rulesDir?: string;
    agentsDir?: string;
    skillsDir?: string;
    mcpDir?: string;
    contextsDir?: string;
    modelsDir?: string;
  };
  /** Defaults */
  defaults?: {
    context?: ContextId;
    model?: ModelId;
    agent?: AgentId;
  };
  /** Layer toggles */
  layers?: {
    base?: { enabled?: boolean };
    context?: { enabled?: boolean };
    model?: { enabled?: boolean };
    cli?: { enabled?: boolean };
  };
  /** Allow-list enables */
  enable?: EnableDisableSet;
  /** Explicit disables */
  disable?: EnableDisableSet;
  /** Imports (e.g., AGENTS.md) */
  imports?: {
    agentsMd?: {
      enabled?: boolean;
      mode?: "nearest-wins" | "repo-root-only";
      includeIn?: "claude" | "all" | "none";
    };
  };
  /** Export policy */
  export?: {
    repo?: { write?: boolean };
    user?: { write?: boolean };
  };
  /** Policy settings */
  policy?: {
    allowMissingDependencies?: boolean;
    allowOverrides?: boolean;
  };
}

// -----------------------------------------------------------------------------
// Source provenance
// -----------------------------------------------------------------------------

export interface SourceInfo {
  type: "repo" | "preset";
  /** For presets: package name + version */
  preset?: string;
  /** File path where the definition was loaded from */
  filePath: string;
}

// -----------------------------------------------------------------------------
// Export targets
// -----------------------------------------------------------------------------

export type ExportTarget = "cursor" | "copilot" | "claude" | "mcp";

export type McpExportTarget =
  | "vscode"
  | "cursor"
  | "claude-desktop"
  | "amazonq";

// -----------------------------------------------------------------------------
// Registry (loaded definitions)
// -----------------------------------------------------------------------------

export interface Registry {
  rules: Map<RuleId, RuleDefinition>;
  agents: Map<AgentId, AgentDefinition>;
  skills: Map<SkillId, SkillDefinition>;
  mcpServers: Map<McpServerId, McpServerDefinition>;
  contexts: Map<ContextId, ContextDefinition>;
  models: Map<ModelId, ModelDefinition>;
}

// -----------------------------------------------------------------------------
// Resolved config (output)
// -----------------------------------------------------------------------------

export interface ResolvedConfig {
  rules: RuleDefinition[];
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  mcpServers: McpServerDefinition[];
  meta: {
    version: 1;
    model?: ModelId;
    context?: ContextId;
    timestamp: string;
    configHash: string;
  };
  trace: ResolutionTrace;
}

// -----------------------------------------------------------------------------
// Resolution trace (audit log)
// -----------------------------------------------------------------------------

export interface ResolutionTrace {
  presets: PresetTraceEntry[];
  layers: LayerTraceEntry[];
  activations: ActivationTraceEntry[];
  warnings: string[];
  errors: string[];
}

export interface PresetTraceEntry {
  ref: string;
  resolvedPath: string;
  version?: string;
}

export interface LayerTraceEntry {
  layer: "base" | "context" | "model" | "cli";
  enabled: boolean;
  applied: EnableDisableSet;
}

export interface ActivationTraceEntry {
  id: string;
  enabled: boolean;
  reason: string;
  source?: SourceInfo;
}

// -----------------------------------------------------------------------------
// Resolve input
// -----------------------------------------------------------------------------

export interface ResolveInput {
  repoRoot: string;
  model?: ModelId;
  context?: ContextId;
  cliOverlay?: {
    enable?: EnableDisableSet;
    disable?: EnableDisableSet;
  };
}

// -----------------------------------------------------------------------------
// Export result
// -----------------------------------------------------------------------------

export interface ExportResult {
  target: ExportTarget | McpExportTarget;
  filePath: string;
  content: string;
  isUserLevel: boolean;
}
