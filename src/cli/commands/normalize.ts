export type NormalizedType =
  | "framework"
  | "rule"
  | "skill"
  | "mcp-server"
  | "agent";

export function normalizeType(type: string): NormalizedType {
  if (type === "mcp" || type === "mcp-server") return "mcp-server";
  if (type === "rules" || type === "rule") return "rule";
  if (type === "skills" || type === "skill") return "skill";
  if (type === "agents" || type === "agent") return "agent";
  if (type === "framework" || type === "frameworks") return "framework";
  throw new Error(`Unknown type ${type}`);
}
