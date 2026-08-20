#!/usr/bin/env node
/**
 * Wrapper: regenerate Graphify, then run the deterministic deep-cleanup pass.
 *
 * Usage:
 *   node scripts/graphify-update.mjs [path]
 *
 * Defaults to the current working directory when no path is supplied.
 */

import { execSync } from "node:child_process";
import { join } from "node:path";

const target = process.argv[2] ?? ".";
const graphifyCommand = `graphify update ${target} --force`;
const improveCommand = `node ${join(process.cwd(), "scripts", "improve-graphify.mjs")}`;

console.log(`[graphify-update] step 1/2: ${graphifyCommand}`);
execSync(graphifyCommand, { stdio: "inherit" });

console.log(`[graphify-update] step 2/2: ${improveCommand}`);
execSync(improveCommand, { stdio: "inherit" });

console.log("[graphify-update] done");
