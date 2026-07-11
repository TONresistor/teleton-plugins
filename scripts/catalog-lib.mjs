import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { satisfies } from "semver";
import { pluginDirectories, readJson } from "./catalog-source.mjs";

export { pluginDirectories, readJson } from "./catalog-source.mjs";

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const TOOL_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const SDK_RANGE_RE = /^\^\d+\.\d+\.\d+$/;

export function validateCatalog(root = process.cwd()) {
  const errors = [];
  const compatibility = readJson(join(root, "compatibility.json"));
  const directories = pluginDirectories(root);
  const compatibilityIds = Object.keys(compatibility.plugins).sort();

  if (compatibility.schemaVersion !== 1) errors.push("compatibility.schemaVersion must be 1");
  if (!SEMVER_RE.test(compatibility.targetSdkVersion)) {
    errors.push("compatibility.targetSdkVersion must be strict semver");
  }
  if (JSON.stringify(directories) !== JSON.stringify(compatibilityIds)) {
    errors.push("compatibility.json must contain exactly one entry for every plugin directory");
  }
  const manifestTools = new Map();
  const forbiddenSupportedPatterns = [
    ["sdk.telegram.getRawClient(", "removed sdk.telegram.getRawClient()"],
    ["context.bridge", "removed context.bridge"],
    ["ctx.bridge", "removed ctx.bridge"],
    ["wallet.json", "direct wallet file access"],
    [".mnemonic", "direct mnemonic access"],
  ];

  for (const id of directories) {
    const pluginDir = join(root, "plugins", id);
    const manifest = readJson(join(pluginDir, "manifest.json"));
    const policy = compatibility.plugins[id];
    if (!policy || !["supported", "quarantined"].includes(policy.status)) {
      errors.push(`${id}: compatibility status must be supported or quarantined`);
      continue;
    }
    if (typeof policy.marketplace !== "boolean") {
      errors.push(`${id}: compatibility marketplace flag must be boolean`);
    }
    if (policy.marketplace === true && policy.status !== "supported") {
      errors.push(`${id}: only supported plugins may be listed in the marketplace`);
    }
    if (manifest.id !== id) errors.push(`${id}: manifest.id must match its directory`);
    if (!PLUGIN_ID_RE.test(manifest.id ?? "")) errors.push(`${id}: invalid manifest.id`);
    if (typeof manifest.name !== "string" || manifest.name.length === 0) {
      errors.push(`${id}: manifest.name is required`);
    }
    if (!SEMVER_RE.test(manifest.version ?? "")) errors.push(`${id}: invalid manifest.version`);
    if (typeof manifest.description !== "string" || manifest.description.length === 0) {
      errors.push(`${id}: manifest.description is required`);
    }
    if (!manifest.author || typeof manifest.author !== "object") {
      errors.push(`${id}: manifest.author must be an object`);
    }
    if (manifest.license !== "MIT") errors.push(`${id}: manifest.license must be MIT`);
    if (manifest.teleton !== ">=0.9.0") errors.push(`${id}: manifest.teleton must be >=0.9.0`);
    if (manifest.entry !== "index.js" || !existsSync(join(pluginDir, "index.js"))) {
      errors.push(`${id}: manifest.entry must reference index.js`);
    }
    if (!existsSync(join(pluginDir, "README.md"))) errors.push(`${id}: README.md is required`);
    if (!Array.isArray(manifest.permissions)) errors.push(`${id}: permissions must be an array`);
    if (!Array.isArray(manifest.tags)) errors.push(`${id}: tags must be an array`);
    if (existsSync(join(pluginDir, "package.json"))) {
      if (!existsSync(join(pluginDir, "package-lock.json"))) {
        errors.push(`${id}: package-lock.json is required with package.json`);
      }
      const packageJson = readJson(join(pluginDir, "package.json"));
      if (packageJson.type !== "module") errors.push(`${id}: package.json type must be module`);
    }
    if (!Array.isArray(manifest.tools) || manifest.tools.length === 0) {
      errors.push(`${id}: manifest.tools must be a non-empty array`);
      continue;
    }

    const expectedRange = policy.sdkVersion;
    if (expectedRange === null) {
      if (manifest.sdkVersion !== undefined) errors.push(`${id}: sdkVersion must be omitted`);
    } else {
      if (!SDK_RANGE_RE.test(expectedRange)) errors.push(`${id}: invalid compatibility sdkVersion`);
      if (manifest.sdkVersion !== expectedRange) {
        errors.push(`${id}: manifest.sdkVersion must be ${expectedRange}`);
      }
    }

    if (
      policy.status === "supported" &&
      expectedRange &&
      !satisfies(compatibility.targetSdkVersion, expectedRange)
    ) {
      errors.push(
        `${id}: SDK range ${expectedRange} does not include target ${compatibility.targetSdkVersion}`
      );
    }
    if (policy.status === "quarantined") {
      if (policy.marketplace !== false) errors.push(`${id}: quarantined plugins cannot be listed`);
      if (expectedRange !== "^1.0.0") errors.push(`${id}: quarantined plugins must reject SDK v2`);
      if (typeof policy.reason !== "string" || policy.reason.length < 20) {
        errors.push(`${id}: quarantined plugins require a concrete reason`);
      }
      const readme = readFileSync(join(pluginDir, "README.md"), "utf8");
      if (!readme.includes("Legacy SDK v1 plugin") || !readme.includes("quarantined")) {
        errors.push(`${id}: quarantined plugin README must carry the warning banner`);
      }
    }

    const localNames = new Set();
    for (const tool of manifest.tools) {
      if (!TOOL_NAME_RE.test(tool?.name ?? "")) errors.push(`${id}: invalid tool name`);
      if (typeof tool?.description !== "string" || tool.description.length === 0) {
        errors.push(`${id}/${tool?.name ?? "?"}: missing description`);
      }
      if (localNames.has(tool.name)) errors.push(`${id}: duplicate tool ${tool.name}`);
      localNames.add(tool.name);
      const owner = manifestTools.get(tool.name);
      if (owner) errors.push(`${id}: tool ${tool.name} duplicates ${owner}`);
      else manifestTools.set(tool.name, id);
    }

    if (policy.status === "supported") {
      const sourceFiles = listJavaScriptFiles(pluginDir);
      for (const sourceFile of sourceFiles) {
        const source = readFileSync(sourceFile, "utf8");
        for (const [needle, label] of forbiddenSupportedPatterns) {
          if (source.includes(needle)) errors.push(`${id}: ${label} in ${sourceFile.slice(root.length + 1)}`);
        }
      }
    }
  }

  const expectedRegistryIds = directories.filter(
    (id) => compatibility.plugins[id]?.marketplace === true
  );

  return {
    errors,
    pluginCount: directories.length,
    toolCount: manifestTools.size,
    marketplaceCount: expectedRegistryIds.length,
    supportedCount: directories.filter((id) => compatibility.plugins[id].status === "supported")
      .length,
    quarantinedCount: directories.filter(
      (id) => compatibility.plugins[id].status === "quarantined"
    ).length,
  };
}

function listJavaScriptFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJavaScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}
