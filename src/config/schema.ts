import { z } from "zod";
import type { ConfigDefinition, ConfigVersion, ScopeLevel } from "../types/index.js";

const scopeSchema = z.enum(["global", "project"]).optional();
const optionalScopeSchema: z.ZodType<ScopeLevel | undefined> = scopeSchema;

const contextSchema = z
  .object({
    frameworks: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    model: z.string().optional(),
  })
  .strict();

const projectSchema = z
  .object({
    name: z.string().optional(),
    root: z.string().optional(),
    context: contextSchema.optional(),
  })
  .strict();

const ruleSchema = z
  .object({
    id: z.string(),
    enabled: z.boolean().optional(),
    source: z.enum(["builtin", "custom"]).optional(),
  })
  .strict();

const skillSchema = z
  .object({
    id: z.string(),
    enabled: z.boolean().optional(),
    scope: optionalScopeSchema,
  })
  .strict();

const mcpServerSchema = z
  .object({
    id: z.string(),
    enabled: z.boolean().optional(),
    scope: optionalScopeSchema,
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    version: z.string().optional(),
  })
  .strict();

const agentSchema = z
  .object({
    id: z.string(),
    model: z.string().optional(),
    skills: z.array(z.string()).optional(),
    rules: z.array(z.string()).optional(),
  })
  .strict();

export const configSchema = z
  .object({
    version: z.literal(1),
    project: projectSchema.optional(),
    mcpServers: z.array(mcpServerSchema).optional(),
    rules: z.array(ruleSchema).optional(),
    skills: z.array(skillSchema).optional(),
    agents: z.array(agentSchema).optional(),
  })
  .strict();

export type ConfigSchema = z.infer<typeof configSchema>;

export function parseConfigDefinition(data: unknown): ConfigDefinition {
  return configSchema.parse(data) as ConfigDefinition;
}

export function createEmptyConfig(): ConfigDefinition {
  const version: ConfigVersion = 1;
  return {
    version,
    project: { context: {} },
    mcpServers: [],
    rules: [],
    skills: [],
    agents: [],
  };
}
