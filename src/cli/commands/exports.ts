import * as fs from "node:fs";
import * as path from "node:path";
import type { ExportResult } from "../../types/index.js";
import { resolveConfig } from "../../resolver/index.js";
import { exportConfig, exportMcp } from "../../exporters/index.js";
import { loadAgentsMdForExport } from "./agents-md.js";

export function generateAllExports(
  repoRoot: string,
  model?: string,
  context?: string
): ExportResult[] {
  const resolved = resolveConfig({
    repoRoot,
    model,
    context: context as `context:${string}` | undefined,
  });

  if (resolved.trace.errors.length > 0) {
    throw new Error(
      `Resolution errors:\n${resolved.trace.errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }

  // Load AGENTS.md content if configured
  const agentsMd = loadAgentsMdForExport(repoRoot, process.cwd());

  const results: ExportResult[] = [];

  // Export all tool configs
  results.push(
    ...exportConfig(resolved, {
      repoRoot,
      targets: ["cursor", "copilot", "claude"],
      agentsMdContent: agentsMd.content,
      agentsMdIncludeIn: agentsMd.includeIn,
    })
  );

  // Export MCP for VS Code (most common repo-level target)
  results.push(
    ...exportMcp(resolved, "vscode", {
      repoRoot,
      home: process.env.HOME ?? "",
      userLevel: false,
    })
  );

  return results;
}

export function checkExports(repoRoot: string, model?: string, context?: string): {
  matches: string[];
  mismatches: Array<{ path: string; reason: string }>;
  missing: string[];
} {
  const results = generateAllExports(repoRoot, model, context);

  const matches: string[] = [];
  const mismatches: Array<{ path: string; reason: string }> = [];
  const missing: string[] = [];

  for (const result of results) {
    if (result.isUserLevel) continue; // Skip user-level configs

    const fullPath = path.join(repoRoot, result.filePath);

    if (!fs.existsSync(fullPath)) {
      missing.push(result.filePath);
      continue;
    }

    const existing = fs.readFileSync(fullPath, "utf-8");

    // Normalize content for comparison (ignore timestamp differences)
    const normalizeContent = (content: string): string => {
      return content
        .replace(/Generated at: .*$/gm, "Generated at: [TIMESTAMP]")
        .replace(/"at": ".*"$/gm, '"at": "[TIMESTAMP]"')
        .trim();
    };

    if (normalizeContent(existing) === normalizeContent(result.content)) {
      matches.push(result.filePath);
    } else {
      mismatches.push({
        path: result.filePath,
        reason: "Content differs from generated output",
      });
    }
  }

  return { matches, mismatches, missing };
}
