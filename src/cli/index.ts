#!/usr/bin/env node

import { runMvpCli } from "./run.js";

async function main() {
  await runMvpCli(process.argv);
}

main();

