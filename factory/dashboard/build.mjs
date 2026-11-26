// Erases types from each <name>.ts into dist/<name>.js. `--check` fails on a stale, missing or orphan dist file.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const dist = join(dir, "dist");
const check = process.argv.includes("--check");
const sources = readdirSync(dir).filter((f) => f.endsWith(".ts")).sort();
const outputs = new Map();
let failed = false;

for (const file of sources) {
  try {
    outputs.set(file.replace(/\.ts$/, ".js"), `// Generated from ${file} by build.mjs. Do not edit.\n${stripTypeScriptTypes(readFileSync(join(dir, file), "utf8"), { mode: "strip" })}`);
  } catch (err) {
    console.error(`${file}: cannot strip types: ${err.message}`);
    failed = true;
  }
}

// All or nothing: a failed strip leaves dist/ as it was.
if (!failed) {
  if (!check) mkdirSync(dist, { recursive: true });
  for (const [name, output] of outputs) {
    const target = join(dist, name);
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current === output) continue;
    if (check) {
      console.error(`${target} is ${current === null ? "missing" : "stale"}. Run: node factory/dashboard/build.mjs`);
      failed = true;
    } else {
      writeFileSync(target, output);
    }
  }
}

const built = new Set(sources.map((f) => f.replace(/\.ts$/, ".js")));
for (const name of existsSync(dist) ? readdirSync(dist).filter((f) => f.endsWith(".js")).sort() : []) {
  if (!built.has(name)) {
    console.error(`dist/${name} has no ${name.replace(/\.js$/, ".ts")}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
