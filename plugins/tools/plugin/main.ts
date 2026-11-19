#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Cli } from "./Cli.js";

// Compiled to dist/tools/plugin/main.js; the repository root is three levels up.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

process.exitCode = await new Cli({ root }).run(process.argv.slice(2));
