import { describe, it } from "node:test";
import assert from "node:assert";
import {
  exportCursor,
  exportCopilot,
  exportClaude,
  exportMcp,
  exportConfig,
} from "../src/exporters/index.js";
import type {
  ResolvedConfig,
  RuleDefinition,
  McpServerDefinition,
} from "../src/types/index.js";

function createMockResolved(
  overrides: Partial<ResolvedConfig> = {}
): ResolvedConfig {
  return {
    rules: [],
    agents: [],
    skills: [],
    mcpServers: [],
    meta: {
      version: 1,
      timestamp: "2024-01-01T00:00:00.000Z",
      configHash: "abcd1234",
    },
    trace: {
      presets: [],
      layers: [],
      activations: [],
      warnings: [],
      errors: [],
    },
    ...overrides,
  };
}

function createMockRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: "rule:test",
    content: "Test rule content",
    ...overrides,
  };
}

function createMockMcpServer(
  overrides: Partial<McpServerDefinition> = {}
): McpServerDefinition {
  return {
    id: "mcp:test",
    transport: "stdio",
    command: "npx",
    args: ["-y", "test-server"],
    ...overrides,
  };
}

describe("exportCursor", () => {
  it("exports rules as .mdc files", () => {
    const resolved = createMockResolved({
      rules: [
        createMockRule({ id: "rule:code-style", content: "Use TypeScript" }),
        createMockRule({ id: "rule:testing", content: "Write tests" }),
      ],
    });

    const results = exportCursor(resolved);

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].target, "cursor");
    assert.strictEqual(results[0].filePath, ".cursor/rules/code-style.mdc");
    assert.ok(results[0].content.includes("Use TypeScript"));
    assert.strictEqual(results[1].filePath, ".cursor/rules/testing.mdc");
  });

  it("filters rules by target", () => {
    const resolved = createMockResolved({
      rules: [
        createMockRule({ id: "rule:cursor-only", targets: ["cursor"] }),
        createMockRule({ id: "rule:claude-only", targets: ["claude"] }),
      ],
    });

    const results = exportCursor(resolved);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].filePath, ".cursor/rules/cursor-only.mdc");
  });

  it("includes rules with no target filter", () => {
    const resolved = createMockResolved({
      rules: [createMockRule({ id: "rule:all-targets" })],
    });

    const results = exportCursor(resolved);

    assert.strictEqual(results.length, 1);
  });
});

describe("exportCopilot", () => {
  it("exports rules to single markdown file", () => {
    const resolved = createMockResolved({
      rules: [
        createMockRule({ id: "rule:one", content: "Rule one" }),
        createMockRule({ id: "rule:two", content: "Rule two" }),
      ],
    });

    const results = exportCopilot(resolved);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].target, "copilot");
    assert.strictEqual(results[0].filePath, ".github/copilot-instructions.md");
    assert.ok(results[0].content.includes("Rule one"));
    assert.ok(results[0].content.includes("Rule two"));
  });

  it("includes AGENTS.md content when configured", () => {
    const resolved = createMockResolved({ rules: [createMockRule()] });

    const results = exportCopilot(resolved, {
      agentsMdContent: "# AGENTS Instructions",
      includeAgentsMd: true,
    });

    assert.strictEqual(results.length, 1);
    assert.ok(results[0].content.includes("AGENTS Instructions"));
    assert.ok(results[0].content.includes("Project Context (from AGENTS.md)"));
  });

  it("excludes AGENTS.md content when not configured", () => {
    const resolved = createMockResolved({ rules: [createMockRule()] });

    const results = exportCopilot(resolved, {
      agentsMdContent: "# AGENTS Instructions",
      includeAgentsMd: false,
    });

    assert.strictEqual(results.length, 1);
    assert.ok(!results[0].content.includes("AGENTS Instructions"));
  });

  it("returns empty array when no rules and no AGENTS.md", () => {
    const resolved = createMockResolved({ rules: [] });
    const results = exportCopilot(resolved);
    assert.deepStrictEqual(results, []);
  });
});

describe("exportClaude", () => {
  it("exports rules to CLAUDE.md", () => {
    const resolved = createMockResolved({
      rules: [createMockRule({ content: "Claude rule" })],
    });

    const results = exportClaude(resolved);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].target, "claude");
    assert.strictEqual(results[0].filePath, "CLAUDE.md");
    assert.ok(results[0].content.includes("Claude rule"));
  });

  it("includes AGENTS.md content when configured", () => {
    const resolved = createMockResolved({ rules: [createMockRule()] });

    const results = exportClaude(resolved, {
      agentsMdContent: "# Project Guidelines",
      includeAgentsMd: true,
    });

    assert.ok(results[0].content.includes("Project Guidelines"));
  });
});

describe("exportMcp", () => {
  it("exports MCP servers to vscode format", () => {
    const resolved = createMockResolved({
      mcpServers: [
        createMockMcpServer({
          id: "mcp:filesystem",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "${repoRoot}"],
        }),
      ],
    });

    const results = exportMcp(resolved, "vscode", {
      repoRoot: "/project",
      home: "/Users/test",
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].target, "vscode");
    assert.strictEqual(results[0].filePath, ".vscode/mcp.json");
    assert.strictEqual(results[0].isUserLevel, false);

    const content = JSON.parse(results[0].content);
    assert.ok(content.mcpServers.filesystem);
    assert.strictEqual(content.mcpServers.filesystem.command, "npx");
    assert.ok(content.mcpServers.filesystem.args.includes("/project"));
  });

  it("exports to user-level cursor path", () => {
    const resolved = createMockResolved({ mcpServers: [createMockMcpServer()] });

    const results = exportMcp(resolved, "cursor", {
      repoRoot: "/project",
      home: "/Users/test",
      userLevel: true,
    });

    assert.strictEqual(results[0].filePath, "/Users/test/.cursor/mcp.json");
    assert.strictEqual(results[0].isUserLevel, true);
  });

  it("exports to claude-desktop user path", () => {
    const resolved = createMockResolved({ mcpServers: [createMockMcpServer()] });

    const results = exportMcp(resolved, "claude-desktop", {
      repoRoot: "/project",
      home: "/Users/test",
    });

    assert.strictEqual(
      results[0].filePath,
      "/Users/test/Library/Application Support/Claude/claude_desktop_config.json"
    );
    assert.strictEqual(results[0].isUserLevel, true);
  });

  it("returns empty array when no MCP servers", () => {
    const resolved = createMockResolved({ mcpServers: [] });
    const results = exportMcp(resolved, "vscode", {
      repoRoot: "/project",
      home: "/Users/test",
    });
    assert.deepStrictEqual(results, []);
  });

  it("expands variables in MCP config", () => {
    const resolved = createMockResolved({
      mcpServers: [
        createMockMcpServer({
          id: "mcp:test",
          env: { HOME: "${home}", PROJECT: "${repoRoot}" },
        }),
      ],
    });

    const results = exportMcp(resolved, "vscode", {
      repoRoot: "/my/project",
      home: "/home/user",
    });

    const content = JSON.parse(results[0].content);
    assert.strictEqual(content.mcpServers.test.env.HOME, "/home/user");
    assert.strictEqual(content.mcpServers.test.env.PROJECT, "/my/project");
  });
});

describe("exportConfig", () => {
  it("exports to multiple targets", () => {
    const resolved = createMockResolved({ rules: [createMockRule()] });

    const results = exportConfig(resolved, {
      repoRoot: "/project",
      targets: ["cursor", "copilot", "claude"],
    });

    const targets = results.map((r) => r.target);
    assert.ok(targets.includes("cursor"));
    assert.ok(targets.includes("copilot"));
    assert.ok(targets.includes("claude"));
  });

  it("passes AGENTS.md content to claude by default", () => {
    const resolved = createMockResolved({ rules: [createMockRule()] });

    const results = exportConfig(resolved, {
      repoRoot: "/project",
      targets: ["copilot", "claude"],
      agentsMdContent: "# AGENTS content",
      agentsMdIncludeIn: "claude",
    });

    const copilot = results.find((r) => r.target === "copilot");
    const claude = results.find((r) => r.target === "claude");

    assert.ok(copilot && !copilot.content.includes("AGENTS content"));
    assert.ok(claude && claude.content.includes("AGENTS content"));
  });

  it("passes AGENTS.md content to all when configured", () => {
    const resolved = createMockResolved({ rules: [createMockRule()] });

    const results = exportConfig(resolved, {
      repoRoot: "/project",
      targets: ["copilot", "claude"],
      agentsMdContent: "# AGENTS content",
      agentsMdIncludeIn: "all",
    });

    const copilot = results.find((r) => r.target === "copilot");
    const claude = results.find((r) => r.target === "claude");

    assert.ok(copilot && copilot.content.includes("AGENTS content"));
    assert.ok(claude && claude.content.includes("AGENTS content"));
  });
});
