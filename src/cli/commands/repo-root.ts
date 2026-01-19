import * as fs from "node:fs";
import * as path from "node:path";

export function getRepoRoot(): string {
  // Start from cwd and look for ai.config.jsonc
  let dir = process.cwd();

  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, ".ai", "config.jsonc")) ||
      fs.existsSync(path.join(dir, ".ai", "config.json")) ||
      fs.existsSync(path.join(dir, "ai.config.jsonc")) ||
      fs.existsSync(path.join(dir, "ai.config.json"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  // Fall back to cwd
  return process.cwd();
}
