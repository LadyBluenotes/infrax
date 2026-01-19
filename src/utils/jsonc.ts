import * as fs from "node:fs";
import * as jsonc from "jsonc-parser";

export type JsoncDocument = {
  content: string;
  data: unknown;
  errors: jsonc.ParseError[];
};

export function readJsoncDocument(filePath: string): JsoncDocument {
  const content = fs.readFileSync(filePath, "utf-8");
  const errors: jsonc.ParseError[] = [];
  const data = jsonc.parse(content, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  return { content, data, errors };
}

export function applyJsoncEdits(content: string, edits: jsonc.Edit[]): string {
  return jsonc.applyEdits(content, edits);
}

export function setJsoncValue(
  content: string,
  path: jsonc.JSONPath,
  value: unknown,
  insertSpaces = 2
): string {
  const edits = jsonc.modify(content, path, value, {
    formattingOptions: { insertSpaces: true, tabSize: insertSpaces },
  });
  return applyJsoncEdits(content, edits);
}

export function removeJsoncValue(
  content: string,
  path: jsonc.JSONPath,
  insertSpaces = 2
): string {
  const edits = jsonc.modify(content, path, undefined, {
    formattingOptions: { insertSpaces: true, tabSize: insertSpaces },
  });
  return applyJsoncEdits(content, edits);
}
