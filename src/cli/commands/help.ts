import { colors, VERSION } from "./shared.js";

export function printHelp() {
  console.log(`
${colors.bold}infrax v${VERSION}${colors.reset} - Portable, model-aware AI configuration


${colors.bold}USAGE:${colors.reset}
  infrax <command> [options]

${colors.bold}COMMANDS:${colors.reset}
  init                 Initialize a new ai.config.jsonc in current directory
  resolve              Resolve configuration and output JSON
  list <type>          List items (rules, agents, skills, mcp)
  enable <id>          Enable an item (ephemeral unless --write)
  disable <id>         Disable an item (ephemeral unless --write)
  export <target>      Export to tool format (cursor, copilot, claude, mcp, all)
  explain              Show resolution trace
  check                Validate configuration (add --exports to check generated files)
  drift                Show differences between generated and committed exports
  help                 Show this help message

${colors.bold}OPTIONS:${colors.reset}
  --model <id>         Select model for resolution
  --context <id>       Select context for resolution
  --write              Persist changes to config / write export files
  --user               Target user-level config (for MCP exports)
  --force              Required with --user --write for safety
  --target <client>    MCP client target (vscode, cursor, claude-desktop, amazonq)
  --mcp <name>         Enable MCP server by alias (e.g. filesystem) or id (mcp:foo); repeatable; supports comma-separated
  --mcp-none           Disable all MCP servers for this run (overrides config)
  --catalog            With 'list mcp': show built-in MCP catalog aliases
  --all                Show all items (not just active)
  --json               Output as JSON
  --exports            Check that generated exports match committed files

${colors.bold}EXAMPLES:${colors.reset}
  infrax init
  infrax resolve --model anthropic:claude-3.5-sonnet
  infrax list rules --all
  infrax enable rule:testing --write
  infrax export cursor --write
  infrax export all --write
  infrax export mcp --target vscode --write
  infrax export mcp --target claude-desktop --user --write --force
  infrax export mcp --target vscode --mcp filesystem --mcp github --write
  infrax list mcp --catalog
  infrax check --exports
  infrax drift
`);
}
