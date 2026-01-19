import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

const CLI_PATH = path.join(import.meta.dirname, "..", "src", "cli", "index.ts");
const TSX_LOADER = path.join(import.meta.dirname, "..", "node_modules", "tsx", "dist", "loader.mjs");

function getHomeDir(cwd: string): string {
  return path.join(cwd, ".home");
}

function runCli(
  args: string[],
  cwd: string
): { stdout: string; stderr: string; exitCode: number } {
  const homeDir = getHomeDir(cwd);
  fs.mkdirSync(homeDir, { recursive: true });

  try {
    const quotedArgs = args.map((a) => JSON.stringify(a)).join(" ");
    const stdout = execSync(
      `node --import ${JSON.stringify(TSX_LOADER)} ${JSON.stringify(CLI_PATH)} ${quotedArgs}`,
      {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, HOME: homeDir },
      }
    );
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

function writeConfig(cwd: string, config: Record<string, unknown>): string {
  const configDir = path.join(cwd, ".infrax");
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, "config.jsonc");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

function readConfig(cwd: string): Record<string, unknown> {
  const configPath = path.join(cwd, ".infrax", "config.jsonc");
  return JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
}

function writeGlobalConfig(cwd: string, config: Record<string, unknown>): string {
  const homeDir = getHomeDir(cwd);
  const configDir = path.join(homeDir, ".infrax");
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, "config.jsonc");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
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
    it("shows help with --help flag", () => {
      const { stdout } = runCli(["--help"], tempDir);
      assert.ok(stdout.includes("Commands:"));
    });

    it("shows help with help command", () => {
      const { stdout } = runCli(["help"], tempDir);
      assert.ok(stdout.includes("COMMANDS"));
      assert.ok(stdout.includes("infrax"));
    });
  });

  describe("init", () => {
    it("creates a config in the project", () => {
      const { exitCode } = runCli(["init"], tempDir);
      assert.strictEqual(exitCode, 0);

      const configPath = path.join(tempDir, ".infrax", "config.jsonc");
      assert.ok(fs.existsSync(configPath));

      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      assert.strictEqual(config.version, 1);
    });
  });

  describe("validate", () => {
    it("validates a correct configuration", () => {
      writeConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:test", enabled: true }],
      });

      const { stdout, exitCode } = runCli(["validate"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("Config valid"));
    });

    it("reports errors for invalid configuration", () => {
      writeConfig(tempDir, { version: 2 });

      const { exitCode } = runCli(["validate"], tempDir);
      assert.strictEqual(exitCode, 1);
    });
  });

  describe("resolve", () => {
    it("outputs merged configuration as JSON", () => {
      writeConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:test", enabled: true }],
      });

      const { stdout, exitCode } = runCli(["resolve"], tempDir);

      assert.strictEqual(exitCode, 0);
      const resolved = JSON.parse(stdout);
      assert.strictEqual(resolved.version, 1);
      assert.ok(Array.isArray(resolved.rules));
    });
  });

  describe("list", () => {
    it("lists rules", () => {
      writeConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:test", enabled: true }],
      });

      const { stdout, exitCode } = runCli(["list", "rules", "--local"], tempDir);

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("rule:test"));
    });

    it("shows error for invalid list type", () => {
      writeConfig(tempDir, { version: 1 });

      const { stderr, exitCode } = runCli(["list", "invalid"], tempDir);

      assert.strictEqual(exitCode, 1);
      assert.ok(stderr.includes("Unknown type"));
    });
  });

  describe("export", () => {
    it("exports config to JSON", () => {
      writeConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:code-style", enabled: true }],
      });

      const outputPath = path.join(tempDir, "export.json");
      const { exitCode } = runCli(
        ["export", "--target", "config", "--format", "json", "--output", outputPath],
        tempDir
      );

      assert.strictEqual(exitCode, 0);
      assert.ok(fs.existsSync(outputPath));
      const content = fs.readFileSync(outputPath, "utf-8");
      assert.ok(content.includes("rule:code-style"));
    });

    it("exports AGENTS.md content", () => {
      writeConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:code-style", enabled: true }],
      });

      const outputPath = path.join(tempDir, "AGENTS.md");
      const { exitCode } = runCli(
        ["export", "--target", "agents", "--format", "md", "--output", outputPath],
        tempDir
      );

      assert.strictEqual(exitCode, 0);
      assert.ok(fs.existsSync(outputPath));
      const content = fs.readFileSync(outputPath, "utf-8");
      assert.ok(content.includes("<!-- infrax:start -->"));
    });

    it("rejects invalid target/format combinations", () => {
      const { exitCode } = runCli(["export", "--target", "agents", "--format", "yaml"], tempDir);
      assert.strictEqual(exitCode, 1);
    });
  });

  describe("enable/disable", () => {
    it("enables item in config", () => {
      writeConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:existing", enabled: true }],
      });

      const { exitCode } = runCli(["enable", "rule", "rule:new-rule"], tempDir);
      assert.strictEqual(exitCode, 0);

      const config = readConfig(tempDir);
      const rules = (config.rules as Array<{ id: string; enabled?: boolean }>) ?? [];
      assert.ok(rules.some((rule) => rule.id === "rule:new-rule" && rule.enabled === true));
    });

    it("disables item in config", () => {
      writeConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:existing", enabled: true }],
      });

      const { exitCode } = runCli(["disable", "rule", "rule:existing"], tempDir);
      assert.strictEqual(exitCode, 0);

      const config = readConfig(tempDir);
      const rules = (config.rules as Array<{ id: string; enabled?: boolean }>) ?? [];
      assert.ok(rules.some((rule) => rule.id === "rule:existing" && rule.enabled === false));
    });

    it("shows error for invalid type", () => {
      const { stderr, exitCode } = runCli(["enable", "invalid", "foo"], tempDir);

      assert.strictEqual(exitCode, 1);
      assert.ok(stderr.includes("Unknown type"));
    });
  });

  describe("import", () => {
    it("imports config from file", () => {
      const importPath = path.join(tempDir, "import.json");
      fs.writeFileSync(importPath, JSON.stringify({ version: 1, rules: [] }, null, 2));

      const { exitCode } = runCli([
        "import",
        "--file",
        importPath,
        "--config",
        path.join(tempDir, ".infrax", "config.jsonc"),
      ], tempDir);

      assert.strictEqual(exitCode, 0);
      const config = readConfig(tempDir);
      assert.strictEqual(config.version, 1);
    });
  });

  describe("update", () => {
    it("updates AGENTS.md from merged config", () => {
      writeConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:local", enabled: true }],
      });
      writeGlobalConfig(tempDir, {
        version: 1,
        rules: [{ id: "rule:global", enabled: true }],
      });

      const { exitCode } = runCli(["update", "--merge"], tempDir);
      assert.strictEqual(exitCode, 0);

      const agentsPath = path.join(tempDir, "AGENTS.md");
      assert.ok(fs.existsSync(agentsPath));
      const content = fs.readFileSync(agentsPath, "utf-8");
      assert.ok(content.includes("rule:local"));
      assert.ok(content.includes("rule:global"));
    });
  });
});
