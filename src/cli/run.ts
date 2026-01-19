import { buildProgram } from "./program.js";
import { formatError } from "./commands/shared.js";

export async function runMvpCli(argv: string[]): Promise<void> {
  const program = buildProgram();

  program.hook("preAction", (command) => {
    command.setOptionValue("cwd", process.cwd());
  });

  program
    .command("_internal")
    .description("Internal noop")
    .action(() => {});

  const userArgs = argv.slice(2);

  try {
    await program.parseAsync(userArgs, { from: "user" });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "(outputHelp)") {
        return;
      }
      console.error(formatError(err.message));
    }
    process.exit(1);
  }
}
