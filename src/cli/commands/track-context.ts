import { detectContext } from "../../config/index.js";

export function registerTrackContextCommand(
  program: import("commander").Command
): void {
  program
    .command("track-context")
    .description("Show detected context")
    .action(() => {
      const context = detectContext(process.cwd());
      console.log(JSON.stringify(context, null, 2));
    });
}
