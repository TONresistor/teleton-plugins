import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const pluginsDir = resolve("plugins");
const packageDirs = readdirSync(pluginsDir)
  .map((name) => join(pluginsDir, name))
  .filter((dir) => existsSync(join(dir, "package.json")))
  .sort();

for (const dir of packageDirs) {
  if (!existsSync(join(dir, "package-lock.json"))) {
    console.error(`ERROR: ${dir} has package.json but no package-lock.json`);
    process.exitCode = 1;
    continue;
  }

  const name = dir.split("/").at(-1);
  console.log(`Installing ${name} dependencies...`);
  const result = spawnSync(
    "npm",
    ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
    {
      cwd: dir,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "inherit",
    }
  );
  if (result.status !== 0) process.exitCode = 1;
}

if (!process.exitCode) console.log(`Installed dependencies for ${packageDirs.length} plugins`);
