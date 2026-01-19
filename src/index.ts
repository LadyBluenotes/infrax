/**
 * infrax - Portable, model-aware AI configuration
 */

// Types
export type {
  RuleId,
  AgentId,
  SkillId,
  McpServerId,
  ContextId,
  ModelId,
  PresetId,
  Selectors,
  RuleDefinition,
  AgentDefinition,
  InstructionVariant,
  SkillDefinition,
  SkillGrant,
  McpServerDefinition,
  McpTransport,
  ContextDefinition,
  ModelDefinition,
  EnableDisableSet,
  PresetManifest,
  RootConfig,
  SourceInfo,
  ExportTarget,
  McpExportTarget,
  Registry,
  ResolvedConfig,
  ResolutionTrace,
  PresetTraceEntry,
  LayerTraceEntry,
  ActivationTraceEntry,
  ResolveInput,
  ExportResult,
  ConfigDefinition,
  ConfigRule,
  ConfigSkill,
  ConfigMcpServer,
  ConfigAgent,
  ContextInfo,
  ProjectInfo,
  MergeResult,
  Conflict,
} from "./types/index.js";


// Loaders
export {
  loadRootConfig,
  loadPresetManifest,
  loadFullRegistry,
  parseRuleFile,
  resolvePresetPath,
} from "./loaders/index.js";

// Resolver
export { resolveConfig, explainResolution } from "./resolver/resolver.js";

// Exporters
export {
  exportConfig,
  exportCursor,
  exportCopilot,
  exportClaude,
  exportMcp,
} from "./exporters/index.js";

// Config helpers
export {
  createEmptyConfig,
  parseConfigDefinition,
  configSchema,
  loadConfig,
  saveConfig,
  ensureConfigExists,
  mergeConfigs,
  detectContext,
  addConfigItem,
  toggleItem,
  validateConfig,
  renderAgentsMdBlock,
  updateAgentsMdFile,
  resolveAgentsMdPath,
} from "./config/index.js";

// Utils (selective)
export {
  expandVariables,
  matchPattern,
  simpleHash,
  readJsoncDocument,
  applyJsoncEdits,
  setJsoncValue,
  removeJsoncValue,
} from "./utils/index.js";

