export function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean | string[]>;
} {
  const result = {
    command: "",
    positional: [] as string[],
    flags: {} as Record<string, string | boolean | string[]>,
  };

  let i = 0;

  // First arg is command
  if (args.length > 0 && !args[0].startsWith("-")) {
    result.command = args[0];
    i = 1;
  }

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        const val = nextArg;
        const existing = result.flags[key];
        if (existing === undefined) {
          result.flags[key] = val;
        } else if (Array.isArray(existing)) {
          existing.push(val);
          result.flags[key] = existing;
        } else {
          result.flags[key] = [String(existing), val];
        }
        i += 2;
      } else {
        result.flags[key] = true;
        i += 1;
      }
    } else {
      result.positional.push(arg);
      i += 1;
    }
  }

  return result;
}
