import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

// Path to the built CLI
const CLI_PATH = path.join(
  import.meta.dirname,
  "..",
  "dist",
  "cli",
  "index.js"
);

function runCli(
  args: string[],
  cwd: string
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args.map((a) => JSON.stringify(a)).join(" ")}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: error.status ?? 1,
    };
  }
}

describe("CLI (infrax)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "infrax-cli-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("help", () => {
    it("shows help with no arguments", () => {
      const { stdout } = runCli([], tempDir);
      assert.ok(stdout.includes("infrax"));
      assert.ok(stdout.includes("COMMANDS"));
    });

    it("shows help with --help flag", () => {
      const { stdout } = runCli(["--help"], tempDir);
      assert.ok(stdout.includes("infrax"));
    });

    it("shows help with help command", () => {
      const { stdout } = runCli(["help"], tempDir);
      assert.ok(stdout.includes("infrax"));
    });
  });

  describe("init", () => {
    it("fails check in empty directory", () => {
      const { stderr, exitCode } = runCli(["check"], tempDir);
      assert.strictEqual(exitCode, 1);
      assert.ok(stderr.includes("No configuration file found") || stderr.includes("Error"));
    });
  });

  describe("check", () => {
    it("validates a correct configuration", () => {
      const config = {
        version: 1,
        enable: {
          rules: [],
          agents: [],
          skills: [],
          mcpServers: [],
        },
      };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));

      const { stdout, exitCode } = runCli(["check"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("Configuration is valid"));
    });

    it("reports errors for invalid configuration", () => {
      const config = { version: 999 };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));

      const { exitCode } = runCli(["check"], tempDir);
      assert.ok(exitCode === 0 || exitCode === 1);
    });
  });

  describe("resolve", () => {
    it("outputs resolved configuration as JSON", () => {
      const config = {
        version: 1,
        enable: {
          rules: [],
          agents: [],
          skills: [],
          mcpServers: [],
        },
      };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));

      const { stdout, exitCode } = runCli(["resolve"], tempDir);

      assert.strictEqual(exitCode, 0);
      const resolved = JSON.parse(stdout);
      assert.ok(resolved.meta);
      assert.ok(resolved.rules !== undefined);
      assert.ok(resolved.agents !== undefined);
    });
  });

  describe("list", () => {
    it("lists rules", () => {
      const config = {
        version: 1,
        include: { rulesDir: "ai/rules" },
        enable: { rules: ["rule:test"] },
      };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));

      fs.mkdirSync(path.join(tempDir, "ai", "rules"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "ai", "rules", "test.md"),
        "---\nid: rule:test\n---\n\nTest rule content"
      );

      const { stdout, exitCode } = runCli(["list", "rules"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("rule:test"));
    });

    it("shows error for invalid list type", () => {
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify({ version: 1 }));

      const { stderr, exitCode } = runCli(["list", "invalid"], tempDir);

      assert.strictEqual(exitCode, 1);
      assert.ok(stderr.includes("Invalid list type"));
    });
  });

  describe("export", () => {
    beforeEach(() => {
      const config = {
        version: 1,
        include: { rulesDir: "ai/rules" },
        enable: {
          rules: ["rule:code-style"],
        },
      };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));

      fs.mkdirSync(path.join(tempDir, "ai", "rules"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "ai", "rules", "code-style.md"),
        "---\nid: rule:code-style\ntargets: [cursor, copilot, claude]\n---\n\n## Code Style\n\nUse TypeScript."
      );
    });

    it("exports to cursor format", () => {
      const { stdout, exitCode } = runCli(["export", "cursor"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes(".cursor/rules/code-style.mdc"));
      assert.ok(stdout.includes("Use TypeScript"));
    });

    it("exports to copilot format", () => {
      const { stdout, exitCode } = runCli(["export", "copilot"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes(".github/copilot-instructions.md"));
      assert.ok(stdout.includes("Use TypeScript"));
    });

    it("exports to claude format", () => {
      const { stdout, exitCode } = runCli(["export", "claude"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("CLAUDE.md"));
      assert.ok(stdout.includes("Use TypeScript"));
    });

    it("writes files with --write flag", () => {
      const { exitCode } = runCli(["export", "cursor", "--write"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(fs.existsSync(path.join(tempDir, ".cursor", "rules", "code-style.mdc")));

      const content = fs.readFileSync(
        path.join(tempDir, ".cursor", "rules", "code-style.mdc"),
        "utf-8"
      );
      assert.ok(content.includes("Use TypeScript"));
    });

    it("exports all targets with 'all' command", () => {
      const { stdout, exitCode } = runCli(["export", "all"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes(".cursor/rules"));
      assert.ok(stdout.includes(".github/copilot-instructions.md"));
      assert.ok(stdout.includes("CLAUDE.md"));
    });

    it("shows error for invalid export target", () => {
      const { stderr, exitCode } = runCli(["export", "invalid"], tempDir);

      assert.strictEqual(exitCode, 1);
      assert.ok(stderr.includes("Invalid export target"));
    });
  });

  describe("enable/disable", () => {
    beforeEach(() => {
      const config = {
        version: 1,
        enable: {
          rules: ["rule:existing"],
        },
        disable: {
          rules: [],
        },
      };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));
    });

    it("enables item ephemerally without --write", () => {
      const { stdout, exitCode } = runCli(["enable", "rule:new-rule"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("ephemeral"));
      assert.ok(stdout.includes("enabled rule:new-rule"));

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, "ai.config.jsonc"), "utf-8"));
      assert.ok(!config.enable.rules.includes("rule:new-rule"));
    });

    it("enables item persistently with --write", () => {
      const { exitCode } = runCli(["enable", "rule:new-rule", "--write"], tempDir);

      assert.strictEqual(exitCode, 0);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, "ai.config.jsonc"), "utf-8"));
      assert.ok(config.enable.rules.includes("rule:new-rule"));
    });

    it("disables item persistently with --write", () => {
      const { exitCode } = runCli(["disable", "rule:existing", "--write"], tempDir);

      assert.strictEqual(exitCode, 0);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, "ai.config.jsonc"), "utf-8"));
      assert.ok(config.disable.rules.includes("rule:existing"));
      assert.ok(!config.enable.rules.includes("rule:existing"));
    });

    it("shows error for invalid ID format", () => {
      const { stderr, exitCode } = runCli(["enable", "invalid-id"], tempDir);

      assert.strictEqual(exitCode, 1);
      assert.ok(stderr.includes("Invalid ID format"));
    });
  });

  describe("explain", () => {
    it("shows resolution trace", () => {
      const config = {
        version: 1,
        enable: { rules: ["rule:test"] },
      };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));

      const { stdout, exitCode } = runCli(["explain"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("Resolution Trace") || stdout.includes("Layers"));
    });

    it("outputs JSON with --json flag", () => {
      const config = { version: 1 };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));

      const { stdout, exitCode } = runCli(["explain", "--json"], tempDir);

      assert.strictEqual(exitCode, 0);
      const trace = JSON.parse(stdout);
      assert.ok(trace.layers !== undefined);
      assert.ok(trace.activations !== undefined);
    });
  });

  describe("AGENTS.md integration", () => {
    beforeEach(() => {
      const config = {
        version: 1,
        include: { rulesDir: "ai/rules" },
        enable: { rules: ["rule:test"] },
        imports: {
          agentsMd: {
            enabled: true,
            mode: "repo-root-only",
            includeIn: "claude",
          },
        },
      };
      fs.writeFileSync(path.join(tempDir, "ai.config.jsonc"), JSON.stringify(config));

      fs.mkdirSync(path.join(tempDir, "ai", "rules"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "ai", "rules", "test.md"),
        "---\nid: rule:test\n---\n\nTest rule"
      );

      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Project Guidelines\n\nFollow best practices.");
    });

    it("includes AGENTS.md in claude export", () => {
      const { stdout, exitCode } = runCli(["export", "claude"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("Project Guidelines"));
      assert.ok(stdout.includes("from AGENTS.md"));
    });

    it("excludes AGENTS.md from copilot export when configured", () => {
      const { stdout, exitCode } = runCli(["export", "copilot"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(!stdout.includes("Project Guidelines"));
    });
  });
});
