import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";

export { loadRootConfig } from "./config.js";
import type {
  RootConfig,
  PresetManifest,
  Registry,
  RuleDefinition,
  AgentDefinition,
  SkillDefinition,
  McpServerDefinition,
  ContextDefinition,
  ModelDefinition,
  SourceInfo,
  RuleId,
} from "../types/index.js";
import {
  readJsoncFile,
  fileExists,
  directoryExists,
  listFiles,
} from "../utils/index.js";


const PRESET_FILES = ["ai.preset.jsonc", "ai.preset.json"];



/**
 * Resolve a preset reference to a path.
 */
export function resolvePresetPath(
  presetRef: string,
  basedir: string
): { path: string; version?: string } {
  // Local path (relative or absolute)
  if (presetRef.startsWith(".") || presetRef.startsWith("/")) {
    const resolvedPath = path.resolve(basedir, presetRef);
    return { path: resolvedPath };
  }

  // npm package reference
  // Extract package name and version from ref like "@scope/pkg@^1" or "pkg@1.0.0"
  const versionMatch = presetRef.match(/^(.+?)(?:@([^@]+))?$/);
  const packageName = versionMatch?.[1] ?? presetRef;
  const versionSpec = versionMatch?.[2];

  // Try to find the package in node_modules (walk up directories)
  let searchDir = basedir;
  while (searchDir !== path.dirname(searchDir)) {
    const candidatePath = path.join(searchDir, "node_modules", packageName);
    const packageJsonPath = path.join(candidatePath, "package.json");

    if (fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, "utf-8")
      ) as { version?: string };

      return {
        path: candidatePath,
        version: packageJson.version ?? versionSpec,
      };
    }

    searchDir = path.dirname(searchDir);
  }

  throw new Error(
    `Failed to resolve preset "${presetRef}". Make sure the package is installed.`
  );
}

/**
 * Load a preset manifest.
 */
export function loadPresetManifest(presetPath: string): PresetManifest {
  for (const presetFile of PRESET_FILES) {
    const manifestPath = path.join(presetPath, presetFile);
    if (fileExists(manifestPath)) {
      return readJsoncFile<PresetManifest>(manifestPath);
    }
  }

  throw new Error(
    `No preset manifest found at ${presetPath}. Expected one of: ${PRESET_FILES.join(", ")}`
  );
}

/**
 * Parse a rule file (Markdown with YAML frontmatter).
 */
export function parseRuleFile(
  filePath: string,
  source: SourceInfo
): RuleDefinition {
  const content = fs.readFileSync(filePath, "utf-8");
  const { data, content: body } = matter(content);

  if (!data.id) {
    throw new Error(`Rule file ${filePath} is missing required 'id' field`);
  }

  return {
    id: data.id as RuleId,
    content: body.trim(),
    targets: data.targets,
    selectors: data.selectors,
    scope: data.scope,
    override: data.override,
    source,
  };
}

/**
 * Load rules from a directory.
 */
export function loadRulesFromDir(
  dirPath: string,
  source: SourceInfo
): RuleDefinition[] {
  const files = listFiles(dirPath, [".md"]);
  return files.map((file) =>
    parseRuleFile(file, { ...source, filePath: file })
  );
}

/**
 * Load JSONC definitions from a directory.
 */
function loadJsoncDefinitions<T extends { id: string }>(
  dirPath: string,
  source: SourceInfo
): T[] {
  const files = listFiles(dirPath, [".jsonc", ".json"]);
  return files.map((file) => {
    const def = readJsoncFile<T>(file);
    return {
      ...def,
      source: { ...source, filePath: file },
    };
  });
}

/**
 * Load agents from a directory.
 */
export function loadAgentsFromDir(
  dirPath: string,
  source: SourceInfo
): AgentDefinition[] {
  return loadJsoncDefinitions<AgentDefinition>(dirPath, source);
}

/**
 * Load skills from a directory.
 */
export function loadSkillsFromDir(
  dirPath: string,
  source: SourceInfo
): SkillDefinition[] {
  return loadJsoncDefinitions<SkillDefinition>(dirPath, source);
}

/**
 * Load MCP servers from a directory.
 */
export function loadMcpServersFromDir(
  dirPath: string,
  source: SourceInfo
): McpServerDefinition[] {
  return loadJsoncDefinitions<McpServerDefinition>(dirPath, source);
}

/**
 * Load contexts from a directory.
 */
export function loadContextsFromDir(
  dirPath: string,
  source: SourceInfo
): ContextDefinition[] {
  return loadJsoncDefinitions<ContextDefinition>(dirPath, source);
}

/**
 * Load models from a directory.
 */
export function loadModelsFromDir(
  dirPath: string,
  source: SourceInfo
): ModelDefinition[] {
  return loadJsoncDefinitions<ModelDefinition>(dirPath, source);
}

/**
 * Create an empty registry.
 */
export function createEmptyRegistry(): Registry {
  return {
    rules: new Map(),
    agents: new Map(),
    skills: new Map(),
    mcpServers: new Map(),
    contexts: new Map(),
    models: new Map(),
  };
}

/**
 * Add definitions to registry with collision detection.
 */
export function addToRegistry(
  registry: Registry,
  definitions: {
    rules?: RuleDefinition[];
    agents?: AgentDefinition[];
    skills?: SkillDefinition[];
    mcpServers?: McpServerDefinition[];
    contexts?: ContextDefinition[];
    models?: ModelDefinition[];
  },
  allowOverrides: boolean
): string[] {
  const errors: string[] = [];

  function addWithCollisionCheck<K extends string, V extends { id: K; override?: boolean }>(
    map: Map<K, V>,
    items: V[] | undefined,
    typeName: string
  ) {
    if (!items) return;
    for (const item of items) {
      const existing = map.get(item.id);
      if (existing) {
        if (allowOverrides && item.override) {
          map.set(item.id, item);
        } else {
          errors.push(
            `Duplicate ${typeName} id "${item.id}" found. Use 'override: true' to override.`
          );
        }
      } else {
        map.set(item.id, item);
      }
    }
  }

  addWithCollisionCheck(registry.rules, definitions.rules, "rule");
  addWithCollisionCheck(registry.agents, definitions.agents, "agent");
  addWithCollisionCheck(registry.skills, definitions.skills, "skill");
  addWithCollisionCheck(registry.mcpServers, definitions.mcpServers, "mcp");
  addWithCollisionCheck(registry.contexts, definitions.contexts, "context");
  addWithCollisionCheck(registry.models, definitions.models, "model");

  return errors;
}

/**
 * Load definitions from a source (preset or repo).
 */
export function loadDefinitionsFromSource(
  basePath: string,
  include: RootConfig["include"] | PresetManifest["include"],
  source: SourceInfo
): {
  rules: RuleDefinition[];
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  mcpServers: McpServerDefinition[];
  contexts: ContextDefinition[];
  models: ModelDefinition[];
} {
  const result = {
    rules: [] as RuleDefinition[],
    agents: [] as AgentDefinition[],
    skills: [] as SkillDefinition[],
    mcpServers: [] as McpServerDefinition[],
    contexts: [] as ContextDefinition[],
    models: [] as ModelDefinition[],
  };

  const dirs = {
    rules: include?.rulesDir ?? "ai/rules",
    agents: include?.agentsDir ?? "ai/agents",
    skills: include?.skillsDir ?? "ai/skills",
    mcp: include?.mcpDir ?? "ai/mcp",
    contexts: include?.contextsDir ?? "ai/contexts",
    models: include?.modelsDir ?? "ai/models",
  };

  const rulesDir = path.join(basePath, dirs.rules);
  if (directoryExists(rulesDir)) {
    result.rules = loadRulesFromDir(rulesDir, source);
  }

  const agentsDir = path.join(basePath, dirs.agents);
  if (directoryExists(agentsDir)) {
    result.agents = loadAgentsFromDir(agentsDir, source);
  }

  const skillsDir = path.join(basePath, dirs.skills);
  if (directoryExists(skillsDir)) {
    result.skills = loadSkillsFromDir(skillsDir, source);
  }

  const mcpDir = path.join(basePath, dirs.mcp);
  if (directoryExists(mcpDir)) {
    result.mcpServers = loadMcpServersFromDir(mcpDir, source);
  }

  const contextsDir = path.join(basePath, dirs.contexts);
  if (directoryExists(contextsDir)) {
    result.contexts = loadContextsFromDir(contextsDir, source);
  }

  const modelsDir = path.join(basePath, dirs.models);
  if (directoryExists(modelsDir)) {
    result.models = loadModelsFromDir(modelsDir, source);
  }

  return result;
}

/**
 * Load the full registry from root config and presets.
 */
export function loadFullRegistry(
  repoRoot: string,
  rootConfig: RootConfig
): { registry: Registry; errors: string[] } {
  const registry = createEmptyRegistry();
  const errors: string[] = [];
  const allowOverrides = rootConfig.policy?.allowOverrides ?? true;

  // Load presets first (in order)
  if (rootConfig.extends) {
    for (const presetRef of rootConfig.extends) {
      try {
        const { path: presetPath, version } = resolvePresetPath(
          presetRef,
          repoRoot
        );
        const manifest = loadPresetManifest(presetPath);
        const source: SourceInfo = {
          type: "preset",
          preset: `${presetRef}${version ? `@${version}` : ""}`,
          filePath: presetPath,
        };

        const definitions = loadDefinitionsFromSource(
          presetPath,
          manifest.include,
          source
        );
        const addErrors = addToRegistry(registry, definitions, allowOverrides);
        errors.push(...addErrors);
      } catch (e) {
        errors.push(
          `Failed to load preset "${presetRef}": ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  // Load repo definitions last (can override presets)
  const repoSource: SourceInfo = {
    type: "repo",
    filePath: repoRoot,
  };
  const repoDefinitions = loadDefinitionsFromSource(
    repoRoot,
    rootConfig.include,
    repoSource
  );
  const repoErrors = addToRegistry(registry, repoDefinitions, allowOverrides);
  errors.push(...repoErrors);

  return { registry, errors };
}
