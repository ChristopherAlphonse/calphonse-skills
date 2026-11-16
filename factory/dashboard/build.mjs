// Writes each sibling .js from its .ts by erasing types. `--check` writes nothing and fails on a stale or missing .js.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");
let failed = false;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
  const target = join(dir, file.replace(/\.ts$/, ".js"));
  let output;
  try {
    output = `// Generated from ${file} by build.mjs. Do not edit.\n${stripTypeScriptTypes(readFileSync(join(dir, file), "utf8"), { mode: "strip" })}`;
  } catch (err) {
    console.error(`${file}: cannot strip types: ${err.message}`);
    failed = true;
    continue;
  }
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current === output) continue;
  if (check) {
    console.error(`${target} is ${current === null ? "missing" : "stale"}. Run: node factory/dashboard/build.mjs`);
    failed = true;
  } else {
    writeFileSync(target, output);
  }
}

process.exit(failed ? 1 : 0);
