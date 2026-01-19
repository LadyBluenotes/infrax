import type { Command } from "commander";
import { registerAddCommand } from "./commands/add.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerEnableDisableCommands } from "./commands/enable-disable.js";
import { registerExportCommand } from "./commands/export.js";
import { registerImportCommand } from "./commands/import.js";
import { registerInitCommand } from "./commands/init.js";
import { registerListCommand } from "./commands/list.js";
import { registerResolveCommand } from "./commands/resolve.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerTrackContextCommand } from "./commands/track-context.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerValidateCommand } from "./commands/validate.js";

export function registerMvpCommands(program: Command): void {
  registerInitCommand(program);
  registerUpdateCommand(program);
  registerAddCommand(program);
  registerEnableDisableCommands(program);
  registerValidateCommand(program);
  registerExportCommand(program);
  registerImportCommand(program);
  registerListCommand(program);
  registerSyncCommand(program);
  registerAuditCommand(program);
  registerTrackContextCommand(program);
  registerResolveCommand(program);
}
