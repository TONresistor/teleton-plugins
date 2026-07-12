import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { generatedArtifacts } from "./catalog-source.mjs";

const check = process.argv.includes("--check");
const root = process.cwd();
const stale = [];

for (const [path, expected] of generatedArtifacts(root)) {
  const current = readFileSync(path, "utf8");
  if (current === expected) continue;
  if (check) stale.push(relative(root, path));
  else {
    writeFileSync(path, expected, "utf8");
    console.log(`Generated ${relative(root, path)}`);
  }
}

if (stale.length > 0) {
  console.error(`Generated catalog files are stale: ${stale.join(", ")}`);
  console.error("Run: npm run generate");
  process.exit(1);
}

if (check) console.log("Generated catalog files are up to date");
