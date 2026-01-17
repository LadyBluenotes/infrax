import * as fs from "node:fs";
import * as path from "node:path";
import * as jsonc from "jsonc-parser";

/**
 * Read and parse a JSONC file.
 */
export function readJsoncFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, "utf-8");
  const errors: jsonc.ParseError[] = [];
  const result = jsonc.parse(content, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((e) => `${jsonc.printParseErrorCode(e.error)} at offset ${e.offset}`)
      .join(", ");
    throw new Error(`Failed to parse ${filePath}: ${errorMessages}`);
  }

  return result as T;
}

/**
 * Check if a file exists.
 */
export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists.
 */
export function directoryExists(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * List files in a directory with a given extension.
 */
export function listFiles(dirPath: string, extensions: string[]): string[] {
  if (!directoryExists(dirPath)) {
    return [];
  }

  const files = fs.readdirSync(dirPath);
  return files
    .filter((file) => extensions.some((ext) => file.endsWith(ext)))
    .map((file) => path.join(dirPath, file));
}

/**
 * Expand variables in a string (e.g., ${repoRoot}, ${home}).
 */
export function expandVariables(
  value: string,
  variables: Record<string, string>
): string {
  return value.replace(/\$\{(\w+)\}/g, (match, varName) => {
    if (varName in variables) {
      return variables[varName];
    }
    return match; // Leave unresolved if not found
  });
}

/**
 * Expand variables in an object recursively.
 */
export function expandVariablesInObject<T>(
  obj: T,
  variables: Record<string, string>
): T {
  if (typeof obj === "string") {
    return expandVariables(obj, variables) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => expandVariablesInObject(item, variables)) as T;
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandVariablesInObject(value, variables);
    }
    return result as T;
  }
  return obj;
}

/**
 * Create a simple hash of a string (for config hash).
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Match a pattern against a string (simple glob with * support).
 */
export function matchPattern(pattern: string, value: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
    .replace(/\*/g, ".*"); // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(value);
}

/**
 * Deep merge two objects (second wins on conflicts).
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>
): T {
  const result = { ...base };

  for (const key of Object.keys(override) as (keyof T)[]) {
    const baseValue = base[key];
    const overrideValue = override[key];

    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      overrideValue &&
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue)
    ) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue as T[keyof T];
    }
  }

  return result;
}
