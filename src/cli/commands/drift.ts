import * as fs from "node:fs";
import * as path from "node:path";
import { colors, formatSuccess } from "./shared.js";
import { generateAllExports } from "./exports.js";

export function showDrift(repoRoot: string, model?: string, context?: string): void {
  const results = generateAllExports(repoRoot, model, context);

  let hasDrift = false;

  for (const result of results) {
    if (result.isUserLevel) continue;

    const fullPath = path.join(repoRoot, result.filePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`\n${colors.yellow}MISSING:${colors.reset} ${result.filePath}`);
      console.log(
        `${colors.dim}  File does not exist. Run 'infrax export' to create.${colors.reset}`
      );
      hasDrift = true;
      continue;
    }

    const existing = fs.readFileSync(fullPath, "utf-8");

    // Simple line-by-line diff (excluding timestamps)
    const existingLines = existing.split("\n");
    const generatedLines = result.content.split("\n");

    const diffs: Array<{ line: number; type: "add" | "remove"; content: string }> = [];

    // Find differences (simple approach)
    const maxLines = Math.max(existingLines.length, generatedLines.length);
    for (let i = 0; i < maxLines; i++) {
      const existingLine = existingLines[i] ?? "";
      const generatedLine = generatedLines[i] ?? "";

      // Skip timestamp lines
      if (
        existingLine.includes("Generated at:") ||
        existingLine.includes('"at":') ||
        generatedLine.includes("Generated at:") ||
        generatedLine.includes('"at":')
      ) {
        continue;
      }

      if (existingLine !== generatedLine) {
        if (existingLine) {
          diffs.push({ line: i + 1, type: "remove", content: existingLine });
        }
        if (generatedLine) {
          diffs.push({ line: i + 1, type: "add", content: generatedLine });
        }
      }
    }

    if (diffs.length > 0) {
      console.log(`\n${colors.yellow}CHANGED:${colors.reset} ${result.filePath}`);
      for (const diff of diffs.slice(0, 20)) {
        // Limit to first 20 diffs
        if (diff.type === "remove") {
          console.log(`${colors.red}  - ${diff.content}${colors.reset}`);
        } else {
          console.log(`${colors.green}  + ${diff.content}${colors.reset}`);
        }
      }
      if (diffs.length > 20) {
        console.log(
          `${colors.dim}  ... and ${diffs.length - 20} more differences${colors.reset}`
        );
      }
      hasDrift = true;
    }
  }

  if (!hasDrift) {
    console.log(formatSuccess("All exports are up to date."));
  }
}
