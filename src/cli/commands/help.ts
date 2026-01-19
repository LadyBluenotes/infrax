import { colors, VERSION } from "./shared.js";

export function printHelp() {
  console.log(`
${colors.bold}infrax v${VERSION}${colors.reset} - Portable, model-aware AI configuration


${colors.bold}USAGE:${colors.reset}
  infrax <command> [options]

${colors.bold}COMMANDS:${colors.reset}
  init                 Initialize project config
  update               Sync configs and AGENTS.md
  add <type> <name>    Add framework, rule, skill, MCP server
  enable <type> <name> Enable MCP server, rule, or skill
  disable <type> <name> Disable MCP server, rule, or skill
  validate             Check conflicts and errors
  export               Export config or AGENTS.md
  import               Import config from file
  list <type>          List rules, skills, MCP servers, frameworks
  sync                 Merge global + local
  audit                Verify AGENTS.md matches config
  track-context        Show detected context
  resolve              Resolve config for debug
  help                 Show this help message

${colors.bold}OPTIONS:${colors.reset}
  --global             Target global config
  --config <path>      Config file override
  --template <name>    Template name
  --dry-run            Show planned changes
  --merge              Write merged config
  --format <format>    json|yaml|md
  --target <target>    config|agents
  --output <path>      Output path
  --file <path>        File path for import
  --local              List local config
  --registry           List registry items (stub)

${colors.bold}EXAMPLES:${colors.reset}
  infrax init
  infrax init --global
  infrax add rule react-hooks
  infrax enable mcp-server filesystem
  infrax update --merge
  infrax export --target agents --format md
  infrax export --target config --format yaml
  infrax list rules --local
  infrax validate
  infrax audit
  infrax track-context

`);
}
