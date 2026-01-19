import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { colors, formatError, formatSuccess } from "./shared.js";

export async function runInit(repoRoot: string): Promise<void> {
  const configPath = path.join(repoRoot, ".ai", "config.jsonc");

  if (fs.existsSync(configPath)) {
    console.log(
      formatError(
        ".ai/config.jsonc already exists",
        "Delete the existing file or run from a different directory"
      )
    );
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log(`\n${colors.bold}infrax init${colors.reset}\n`);
  console.log("This will create a new .ai/config.jsonc and example files.\n");

  const projectName = await question("Project name (for context): ");
  const useTypeScript =
    (await question("Using TypeScript? (Y/n): ")).toLowerCase() !== "n";
  const addMcp =
    (await question("Include MCP server examples? (Y/n): ")).toLowerCase() !== "n";

  rl.close();

  // Create directories
  const dirs = [
    ".ai/rules",
    ".ai/agents",
    ".ai/skills",
    ".ai/contexts",
    ".ai/models",
  ];
  if (addMcp) dirs.push(".ai/mcp");

  for (const dir of dirs) {
    const fullDir = path.join(repoRoot, dir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }
  }

  // Create config
  const config = {
    version: 1,
    include: {
      rulesDir: ".ai/rules",
      agentsDir: ".ai/agents",
      skillsDir: ".ai/skills",
      mcpDir: addMcp ? ".ai/mcp" : undefined,
      contextsDir: ".ai/contexts",
      modelsDir: ".ai/models", 
    },
    defaults: {
      context: `context:${projectName || "default"}` as const,
    },
    enable: {
      rules: ["rule:code-style"] as `rule:${string}`[],
      agents: ["agent:coding"] as `agent:${string}`[],
      skills: [] as `skill:${string}`[],
      mcpServers: [] as `mcp:${string}`[],
    },
    disable: {
      rules: [] as `rule:${string}`[],
      agents: [] as `agent:${string}`[],
      skills: [] as `skill:${string}`[],
      mcpServers: [] as `mcp:${string}`[],
    },
    policy: {
      allowMissingDependencies: false,
      allowOverrides: true,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(formatSuccess(`Created ${configPath}`));

  // Create example rule
  const ruleContent = `---
id: rule:code-style
targets: [cursor, copilot, claude]
---

## Code Style

${useTypeScript ? "- Use TypeScript for all new code\n" : ""}- Write clean, readable code
- Use meaningful variable and function names
- Keep functions small and focused
- Add comments for complex logic
`;

  fs.writeFileSync(
    path.join(repoRoot, ".ai/rules/code-style.md"),
    ruleContent
  );
  console.log(formatSuccess("Created .ai/rules/code-style.md"));

  // Create example agent
  const agentContent = {
    id: "agent:coding",
    instructions:
      "You are a helpful coding assistant. Follow project conventions and best practices.",
    rules: ["rule:code-style"],
    skills: [],
  };

  fs.writeFileSync(
    path.join(repoRoot, ".ai/agents/coding.jsonc"),
    JSON.stringify(agentContent, null, 2)
  );
  console.log(formatSuccess("Created .ai/agents/coding.jsonc"));

  // Create example context
  const contextContent = {
    id: `context:${projectName || "default"}`,
    description: `${projectName || "Default"} project context`,
    enable: {
      rules: ["rule:code-style"],
    },
  };

  fs.writeFileSync(
    path.join(repoRoot, `.ai/contexts/${projectName || "default"}.jsonc`),
    JSON.stringify(contextContent, null, 2)
  );
  console.log(
    formatSuccess(`Created .ai/contexts/${projectName || "default"}.jsonc`)
  );

  // Create example MCP server if requested
  if (addMcp) {
    const mcpContent = {
      id: "mcp:filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "${repoRoot}"],
      env: {},
    };

    fs.writeFileSync(
        path.join(repoRoot, ".ai/mcp/filesystem.jsonc"),
      JSON.stringify(mcpContent, null, 2)
    );
      console.log(formatSuccess("Created .ai/mcp/filesystem.jsonc"));
  }

  console.log(`
${colors.bold}Next steps:${colors.reset}
  1. Edit .ai/rules/*.md to add your project rules
  2. Run ${colors.blue}infrax check${colors.reset} to validate
  3. Run ${colors.blue}infrax export all --write${colors.reset} to generate tool configs
  4. Commit the generated files to your repo
`);
}
