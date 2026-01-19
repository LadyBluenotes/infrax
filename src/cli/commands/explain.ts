import { explainResolution } from "../../resolver/index.js";
import { colors } from "./shared.js";

export function runExplain(args: {
  repoRoot: string;
  model?: string;
  context?: string;
  json: boolean;
}): void {
  const trace = explainResolution({
    repoRoot: args.repoRoot,
    model: args.model,
    context: args.context as `context:${string}` | undefined,
  });

  if (args.json) {
    console.log(JSON.stringify(trace, null, 2));
    return;
  }

  console.log(`\n${colors.bold}=== Resolution Trace ===${colors.reset}\n`);

  console.log(`${colors.bold}Layers:${colors.reset}`);
  for (const layer of trace.layers) {
    const status = layer.enabled
      ? `${colors.green}enabled${colors.reset}`
      : `${colors.dim}disabled${colors.reset}`;
    console.log(`  ${layer.layer}: ${status}`);
    if (layer.enabled && Object.keys(layer.applied).length > 0) {
      const applied = layer.applied;
      if (applied.rules?.length)
        console.log(`    ${colors.dim}rules: ${applied.rules.join(", ")}${colors.reset}`);
      if (applied.agents?.length)
        console.log(
          `    ${colors.dim}agents: ${applied.agents.join(", ")}${colors.reset}`
        );
      if (applied.skills?.length)
        console.log(
          `    ${colors.dim}skills: ${applied.skills.join(", ")}${colors.reset}`
        );
      if (applied.mcpServers?.length)
        console.log(
          `    ${colors.dim}mcp: ${applied.mcpServers.join(", ")}${colors.reset}`
        );
    }
  }

  console.log(`\n${colors.bold}Activations:${colors.reset}`);
  for (const activation of trace.activations) {
    const status = activation.enabled
      ? `${colors.green}enabled${colors.reset}`
      : `${colors.dim}disabled${colors.reset}`;
    console.log(`  ${activation.id}: ${status}`);
    console.log(`    ${colors.dim}${activation.reason}${colors.reset}`);
  }

  if (trace.warnings.length > 0) {
    console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
    for (const warning of trace.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (trace.errors.length > 0) {
    console.log(`\n${colors.red}Errors:${colors.reset}`);
    for (const error of trace.errors) {
      console.log(`  - ${error}`);
    }
  }
}
