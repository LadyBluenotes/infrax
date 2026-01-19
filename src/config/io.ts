import * as fs from "node:fs";
import * as path from "node:path";
import type { ConfigDefinition } from "../types/index.js";
import {
  formatJsoncParseErrors,
  readJsoncDocument,
  setJsoncValue,
} from "../utils/index.js";
import { parseConfigDefinition, createEmptyConfig } from "./schema.js";

export function loadConfig(filePath: string): ConfigDefinition {
  const document = readJsoncDocument(filePath);
  if (document.errors.length > 0) {
    throw new Error(
      `Failed to parse ${filePath}: ${formatJsoncParseErrors(document.errors)}`
    );
  }

  return parseConfigDefinition(document.data);
}

export function saveConfig(filePath: string, config: ConfigDefinition): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : null;
  let nextContent = existing ?? "{}\n";

  nextContent = setJsoncValue(nextContent, ["version"], config.version);
  nextContent = setJsoncValue(nextContent, ["project"], config.project ?? undefined);
  nextContent = setJsoncValue(nextContent, ["rules"], config.rules ?? []);
  nextContent = setJsoncValue(nextContent, ["skills"], config.skills ?? []);
  nextContent = setJsoncValue(nextContent, ["mcpServers"], config.mcpServers ?? []);
  nextContent = setJsoncValue(nextContent, ["agents"], config.agents ?? []);

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, nextContent);
}

export function ensureConfigExists(filePath: string): void {
  if (fs.existsSync(filePath)) return;
  const config = createEmptyConfig();
  saveConfig(filePath, config);
}
