import { Command } from "commander";
import { VERSION } from "./commands/shared.js";
import { printHelp } from "./commands/help.js";
import { registerMvpCommands } from "./register.js";

export function buildProgram(): Command {
  const program = new Command();
  program.name("infrax").version(VERSION).description("AI config CLI");

  registerMvpCommands(program);

  program.command("help").description("Show help").action(() => {
    printHelp();
  });

  return program;
}
