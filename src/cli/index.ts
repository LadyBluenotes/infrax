#!/usr/bin/env node

import {
  formatError,
  getRepoRoot,
  parseArgs,
  printHelp,
  runCheck,
  runEnableDisable,
  runExport,
  runExplain,
  runInit,
  runList,
  runResolve,
  showDrift,
  colors,
} from "./commands/index.js";

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.command === "help" || parsed.flags.help || parsed.command === "") {
    printHelp();
    process.exit(0);
  }

  const repoRoot = getRepoRoot();
  const model = parsed.flags.model as string | undefined;
  const context = parsed.flags.context as string | undefined;
  const write = parsed.flags.write === true;
  const userLevel = parsed.flags.user === true;
  const force = parsed.flags.force === true;
  const all = parsed.flags.all === true;
  const json = parsed.flags.json === true;
  const checkExportsFlag = parsed.flags.exports === true;

  try {
    switch (parsed.command) {
      case "init": {
        await runInit(process.cwd());
        break;
      }

      case "resolve": {
        runResolve({
          parsed: parsed as { flags: Record<string, unknown> },
          repoRoot,
          model,
          context,
        });
        break;
      }

      case "list": {
        runList({
          repoRoot,
          model,
          context,
          type: parsed.positional[0],
          all,
          json,
          catalog: parsed.flags.catalog === true,
        });
        break;
      }

      case "enable":
      case "disable": {
        runEnableDisable({
          command: parsed.command,
          id: parsed.positional[0],
          repoRoot,
          model,
          context,
          write,
        });
        break;
      }

      case "export": {
        runExport({
          target: parsed.positional[0],
          parsed: parsed as { flags: Record<string, unknown> },
          repoRoot,
          model,
          context,
          write,
          userLevel,
          force,
        });
        break;
      }

      case "explain": {
        runExplain({
          repoRoot,
          model,
          context,
          json,
        });
        break;
      }

      case "check": {
        runCheck({
          repoRoot,
          model,
          context,
          exports: checkExportsFlag,
        });
        break;
      }

      case "drift": {
        console.log(`\n${colors.bold}Checking for drift...${colors.reset}\n`);
        showDrift(repoRoot, model, context);
        break;
      }

      default:
        console.error(
          formatError(
            `Unknown command: "${parsed.command}"`,
            "Run 'infrax help' for available commands"
          )
        );
        process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Provide helpful hints based on error type
    let hint: string | undefined;
    if (message.includes("No configuration file found")) {
      hint = "Run 'infrax init' to create a new configuration";
    } else if (message.includes("not found in registry")) {
      hint = "Check that the ID is correct and the file exists in ai/";
    } else if (message.includes("Failed to resolve preset")) {
      hint = "Make sure the preset package is installed: pnpm add <preset>";
    }

    console.error(formatError(message, hint));
    process.exit(1);
  }
}

main();
