import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { findAgentsMd, loadAgentsMdContent, importAgentsMd } from "../src/loaders/agents-md.js";

describe("agents-md loader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-md-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("findAgentsMd", () => {
    it("finds AGENTS.md at repo root with repo-root-only mode", () => {
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Test");

      const result = findAgentsMd(tempDir, tempDir, "repo-root-only");

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], path.join(tempDir, "AGENTS.md"));
    });

    it("finds AGENTS.override.md as well", () => {
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Main");
      fs.writeFileSync(path.join(tempDir, "AGENTS.override.md"), "# Override");

      const result = findAgentsMd(tempDir, tempDir, "repo-root-only");

      assert.strictEqual(result.length, 2);
      assert.ok(result.includes(path.join(tempDir, "AGENTS.md")));
      assert.ok(result.includes(path.join(tempDir, "AGENTS.override.md")));
    });

    it("returns empty array when no AGENTS.md exists", () => {
      const result = findAgentsMd(tempDir, tempDir, "repo-root-only");
      assert.deepStrictEqual(result, []);
    });

    it("finds nearest AGENTS.md with nearest-wins mode", () => {
      const subDir = path.join(tempDir, "sub");
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Root");
      fs.writeFileSync(path.join(subDir, "AGENTS.md"), "# Sub");

      const result = findAgentsMd(tempDir, subDir, "nearest-wins");

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], path.join(subDir, "AGENTS.md"));
    });

    it("walks up to find AGENTS.md in parent with nearest-wins mode", () => {
      const subDir = path.join(tempDir, "sub", "deep");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Root");

      const result = findAgentsMd(tempDir, subDir, "nearest-wins");

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], path.join(tempDir, "AGENTS.md"));
    });
  });

  describe("loadAgentsMdContent", () => {
    it("loads content from single file", () => {
      const filePath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(filePath, "# Test Content\n\nSome instructions.");

      const result = loadAgentsMdContent([filePath]);

      assert.strictEqual(result, "# Test Content\n\nSome instructions.");
    });

    it("concatenates multiple files with separator", () => {
      const file1 = path.join(tempDir, "AGENTS.md");
      const file2 = path.join(tempDir, "AGENTS.override.md");
      fs.writeFileSync(file1, "# Main");
      fs.writeFileSync(file2, "# Override");

      const result = loadAgentsMdContent([file1, file2]);

      assert.strictEqual(result, "# Main\n\n---\n\n# Override");
    });

    it("skips empty files", () => {
      const file1 = path.join(tempDir, "AGENTS.md");
      const file2 = path.join(tempDir, "AGENTS.override.md");
      fs.writeFileSync(file1, "# Main");
      fs.writeFileSync(file2, "   \n\n  ");

      const result = loadAgentsMdContent([file1, file2]);

      assert.strictEqual(result, "# Main");
    });
  });

  describe("importAgentsMd", () => {
    it("returns null when disabled", () => {
      fs.writeFileSync(path.join(tempDir, "AGENTS.md"), "# Test");

      const result = importAgentsMd(tempDir, tempDir, { enabled: false });

      assert.strictEqual(result, null);
    });

    it("returns null when no files found", () => {
      const result = importAgentsMd(tempDir, tempDir, { enabled: true });

      assert.strictEqual(result, null);
    });

    it("returns content and files when enabled and found", () => {
      const filePath = path.join(tempDir, "AGENTS.md");
      fs.writeFileSync(filePath, "# Test Content");

      const result = importAgentsMd(tempDir, tempDir, { enabled: true });

      assert.ok(result);
      assert.strictEqual(result.content, "# Test Content");
      assert.deepStrictEqual(result.files, [filePath]);
    });

    it("uses nearest-wins mode by default", () => {
      const subDir = path.join(tempDir, "sub");
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, "AGENTS.md"), "# Sub");

      const result = importAgentsMd(tempDir, subDir, { enabled: true });

      assert.ok(result);
      assert.strictEqual(result.content, "# Sub");
    });

    it("respects mode parameter", () => {
      const subDir = path.join(tempDir, "sub");
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, "AGENTS.md"), "# Sub");

      const result = importAgentsMd(tempDir, subDir, {
        enabled: true,
        mode: "nearest-wins",
      });

      assert.ok(result);
      assert.strictEqual(result.content, "# Sub");
    });
  });
});
