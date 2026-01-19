import * as fs from "node:fs";
import * as path from "node:path";

export const VERSION = "0.1.0";

// ANSI colors for terminal output
export const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

export function ensureDirectory(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function formatError(message: string, hint?: string): string {
  let output = `${colors.red}Error:${colors.reset} ${message}`;
  if (hint) {
    output += `\n${colors.dim}Hint: ${hint}${colors.reset}`;
  }
  return output;
}

export function formatWarning(message: string): string {
  return `${colors.yellow}Warning:${colors.reset} ${message}`;
}

export function formatSuccess(message: string): string {
  return `${colors.green}\u2713${colors.reset} ${message}`;
}
