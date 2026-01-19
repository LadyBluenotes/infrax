import { resolveConfig } from "../../resolver/index.js";
import { checkExports } from "./exports.js";
import { colors, formatError, formatSuccess, formatWarning } from "./shared.js";

export function runCheck(args: {
  repoRoot: string;
  model?: string;
  context?: string;
  exports: boolean;
}): void {
  const resolved = resolveConfig({
    repoRoot: args.repoRoot,
    model: args.model,
    context: args.context as `context:${string}` | undefined,
  });

  const hasErrors = resolved.trace.errors.length > 0;
  const hasWarnings = resolved.trace.warnings.length > 0;

  if (hasErrors) {
    console.error(formatError("Configuration has errors:"));
    for (const err of resolved.trace.errors) {
      console.error(`  - ${err}`);
    }
  }

  if (hasWarnings) {
    for (const warning of resolved.trace.warnings) {
      console.log(formatWarning(warning));
    }
  }

  if (!hasErrors && !hasWarnings) {
    console.log(formatSuccess("Configuration is valid"));
    console.log(
      `  ${resolved.rules.length} rules, ${resolved.agents.length} agents, ${resolved.skills.length} skills, ${resolved.mcpServers.length} mcp servers`
    );
  }

  // Check exports if flag is set
  if (args.exports) {
    console.log(`\n${colors.bold}Checking exports...${colors.reset}`);

    const { matches, mismatches, missing } = checkExports(
      args.repoRoot,
      args.model,
      args.context
    );

    if (matches.length > 0) {
      for (const match of matches) {
        console.log(formatSuccess(`${match} is up to date`));
      }
    }

    if (missing.length > 0) {
      for (const file of missing) {
        console.log(
          formatWarning(`${file} is missing (run 'infrax export' to create)`)
        );
      }
    }

    if (mismatches.length > 0) {
      for (const mismatch of mismatches) {
        console.error(formatError(`${mismatch.path}: ${mismatch.reason}`));
      }
    }

    if (mismatches.length > 0) {
      console.error(
        `\n${formatError("Exports are out of sync", "Run 'infrax export all --write' to update")}`
      );
      process.exit(1);
    }
  }

  process.exit(hasErrors ? 1 : 0);
}
