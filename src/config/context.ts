import * as fs from "node:fs";
import * as path from "node:path";
import type { ContextInfo } from "../types/index.js";

export function detectContext(repoRoot: string): ContextInfo {
  const context: ContextInfo = {};

  const packageJsonPath = path.join(repoRoot, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    context.languages = mergeUnique(context.languages, "js");
    context.frameworks = mergeUnique(context.frameworks, "node");
  }

  const tsconfigPath = path.join(repoRoot, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    context.languages = mergeUnique(context.languages, "ts");
  }

  const viteConfig = path.join(repoRoot, "vite.config.ts");
  if (fs.existsSync(viteConfig)) {
    context.frameworks = mergeUnique(context.frameworks, "vite");
  }

  const nextConfig = path.join(repoRoot, "next.config.js");
  if (fs.existsSync(nextConfig)) {
    context.frameworks = mergeUnique(context.frameworks, "nextjs");
  }

  return context;
}

function mergeUnique(values: string[] | undefined, value: string): string[] {
  const set = new Set(values ?? []);
  set.add(value);
  return Array.from(set.values()).sort();
}
