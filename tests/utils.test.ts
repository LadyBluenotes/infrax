import { describe, it } from "node:test";
import assert from "node:assert";
import {
  expandVariables,
  expandVariablesInObject,
  simpleHash,
  matchPattern,
  deepMerge,
} from "../src/utils/index.js";

describe("expandVariables", () => {
  it("expands single variable", () => {
    const result = expandVariables("${home}/config", { home: "/Users/test" });
    assert.strictEqual(result, "/Users/test/config");
  });

  it("expands multiple variables", () => {
    const result = expandVariables("${repoRoot}/${folder}/file", {
      repoRoot: "/project",
      folder: "src",
    });
    assert.strictEqual(result, "/project/src/file");
  });

  it("leaves unknown variables unchanged", () => {
    const result = expandVariables("${unknown}/path", { home: "/Users/test" });
    assert.strictEqual(result, "${unknown}/path");
  });

  it("handles string with no variables", () => {
    const result = expandVariables("plain string", { home: "/Users/test" });
    assert.strictEqual(result, "plain string");
  });
});

describe("expandVariablesInObject", () => {
  it("expands variables in nested object", () => {
    const input = {
      command: "npx",
      args: ["-y", "server", "${repoRoot}"],
      env: {
        HOME: "${home}",
        PATH: "/usr/bin",
      },
    };

    const result = expandVariablesInObject(input, {
      repoRoot: "/project",
      home: "/Users/test",
    });

    assert.deepStrictEqual(result, {
      command: "npx",
      args: ["-y", "server", "/project"],
      env: {
        HOME: "/Users/test",
        PATH: "/usr/bin",
      },
    });
  });

  it("handles arrays", () => {
    const input = ["${home}", "${repoRoot}", "literal"];
    const result = expandVariablesInObject(input, {
      home: "/home",
      repoRoot: "/project",
    });
    assert.deepStrictEqual(result, ["/home", "/project", "literal"]);
  });

  it("handles primitive values", () => {
    assert.strictEqual(expandVariablesInObject(42, {}), 42);
    assert.strictEqual(expandVariablesInObject(true, {}), true);
    assert.strictEqual(expandVariablesInObject(null, {}), null);
  });
});

describe("simpleHash", () => {
  it("returns consistent hash for same input", () => {
    const hash1 = simpleHash("test string");
    const hash2 = simpleHash("test string");
    assert.strictEqual(hash1, hash2);
  });

  it("returns different hash for different input", () => {
    const hash1 = simpleHash("test string 1");
    const hash2 = simpleHash("test string 2");
    assert.notStrictEqual(hash1, hash2);
  });

  it("returns 8-character hex string", () => {
    const hash = simpleHash("any input");
    assert.match(hash, /^[0-9a-f]{8}$/);
  });
});

describe("matchPattern", () => {
  it("matches exact string", () => {
    assert.strictEqual(matchPattern("exact", "exact"), true);
    assert.strictEqual(matchPattern("exact", "different"), false);
  });

  it("matches wildcard at end", () => {
    assert.strictEqual(matchPattern("anthropic:*", "anthropic:claude-3"), true);
    assert.strictEqual(matchPattern("anthropic:*", "openai:gpt-4"), false);
  });

  it("matches wildcard in middle", () => {
    assert.strictEqual(matchPattern("*:claude-*", "anthropic:claude-3.5"), true);
    assert.strictEqual(matchPattern("*:claude-*", "openai:gpt-4"), false);
  });

  it("matches multiple wildcards", () => {
    assert.strictEqual(matchPattern("*:*", "anthropic:claude"), true);
    assert.strictEqual(matchPattern("*-*-*", "a-b-c"), true);
  });

  it("escapes regex special characters", () => {
    assert.strictEqual(matchPattern("file.ts", "file.ts"), true);
    assert.strictEqual(matchPattern("file.ts", "filexts"), false);
  });
});

describe("deepMerge", () => {
  it("merges flat objects", () => {
    const base = { a: 1, b: 2 };
    const override = { b: 3, c: 4 };
    const result = deepMerge(base, override);
    assert.deepStrictEqual(result, { a: 1, b: 3, c: 4 });
  });

  it("merges nested objects", () => {
    const base = {
      outer: {
        inner: 1,
        keep: "original",
      },
    };
    const override = {
      outer: {
        inner: 2,
        keep: "original",
      },
    };
    const result = deepMerge(base, override);
    assert.deepStrictEqual(result, {
      outer: {
        inner: 2,
        keep: "original",
      },
    });
  });

  it("replaces arrays (no merge)", () => {
    const base = { arr: [1, 2, 3] };
    const override = { arr: [4, 5] };
    const result = deepMerge(base, override);
    assert.deepStrictEqual(result, { arr: [4, 5] });
  });

  it("does not modify original objects", () => {
    const base = { a: 1, b: 0 };
    const override = { b: 2 };
    deepMerge(base, override);
    assert.deepStrictEqual(base, { a: 1, b: 0 });
    assert.deepStrictEqual(override, { b: 2 });
  });
});
