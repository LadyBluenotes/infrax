import * as fs from "node:fs";
import * as path from "node:path";
import { fileExists } from "../utils/index.js";

const AGENTS_MD_FILES = ["AGENTS.md", "AGENTS.override.md"];

/**
 * Find AGENTS.md file(s) using the specified mode.
 */
export function findAgentsMd(
  repoRoot: string,
  workingDir: string,
  mode: "nearest-wins" | "repo-root-only"
): string[] {
  const found: string[] = [];

  if (mode === "repo-root-only") {
    // Only check repo root
    for (const filename of AGENTS_MD_FILES) {
      const filePath = path.join(repoRoot, filename);
      if (fileExists(filePath)) {
        found.push(filePath);
      }
    }
  } else {
    // nearest-wins: walk from workingDir up to repoRoot
    let currentDir = workingDir;

    while (true) {
      for (const filename of AGENTS_MD_FILES) {
        const filePath = path.join(currentDir, filename);
        if (fileExists(filePath)) {
          found.push(filePath);
        }
      }

      // If we found something, stop (nearest wins)
      if (found.length > 0) {
        break;
      }

      // If we've reached repo root, stop
      if (currentDir === repoRoot) {
        break;
      }

      // Move up one directory
      const parentDir = path.dirname(currentDir);

      // Safety: stop if we can't go up anymore
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
    }
  }

  return found;
}

/**
 * Load and concatenate AGENTS.md content from found files.
 */
export function loadAgentsMdContent(filePaths: string[]): string {
  const contents: string[] = [];

  for (const filePath of filePaths) {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (content) {
      contents.push(content);
    }
  }

  return contents.join("\n\n---\n\n");
}

/**
 * Import AGENTS.md content with configuration.
 */
export function importAgentsMd(
  repoRoot: string,
  workingDir: string,
  config: {
    enabled?: boolean;
    mode?: "nearest-wins" | "repo-root-only";
  }
): { content: string; files: string[] } | null {
  if (!config.enabled) {
    return null;
  }

  const mode = config.mode ?? "nearest-wins";
  const files = findAgentsMd(repoRoot, workingDir, mode);

  if (files.length === 0) {
    return null;
  }

  const content = loadAgentsMdContent(files);

  return { content, files };
}
