import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const pluginsDir = resolve("plugins");
const packageDirs = readdirSync(pluginsDir)
  .map((name) => join(pluginsDir, name))
  .filter((dir) => existsSync(join(dir, "package.json")))
  .sort();

let failed = false;
for (const dir of packageDirs) {
  const name = dir.split("/").at(-1);
  const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    cwd: dir,
    encoding: "utf8",
  });

  let audit;
  try {
    audit = JSON.parse(result.stdout);
  } catch {
    console.error(`ERROR: ${name}: npm audit did not return JSON`);
    failed = true;
    continue;
  }

  if (!audit.metadata?.vulnerabilities || typeof audit.metadata.vulnerabilities.total !== "number") {
    const detail = audit.error?.summary ?? audit.error?.detail ?? "missing vulnerability metadata";
    console.error(`ERROR: ${name}: npm audit failed: ${detail}`);
    failed = true;
    continue;
  }

  const counts = audit.metadata?.vulnerabilities ?? {};
  console.log(
    `${name}: critical=${counts.critical ?? 0} high=${counts.high ?? 0} ` +
      `moderate=${counts.moderate ?? 0} low=${counts.low ?? 0}`
  );
  if ((counts.critical ?? 0) > 0 || (counts.high ?? 0) > 0) failed = true;
}

if (failed) {
  console.error("ERROR: plugin dependency audit found HIGH or CRITICAL vulnerabilities");
  process.exit(1);
}

console.log(`Dependency audit passed for ${packageDirs.length} plugins`);
