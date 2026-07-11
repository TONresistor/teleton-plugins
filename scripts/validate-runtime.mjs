import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pluginDirectories, readJson, validateCatalog } from "./catalog-lib.mjs";

const root = process.cwd();
const agentDir = resolve(process.env.TELETON_AGENT_DIR ?? "../teleton-agent");
const agentBin = resolve(agentDir, "bin/teleton.js");
const sdkEntry = resolve(agentDir, "packages/sdk/dist/index.js");

if (!existsSync(agentBin)) {
  console.error(`ERROR: Teleton Agent checkout not found at ${agentDir}`);
  process.exit(1);
}
if (!existsSync(sdkEntry)) {
  console.error(`ERROR: Teleton SDK build not found at ${sdkEntry}`);
  console.error(`Run: npm --prefix ${agentDir} run build:sdk`);
  process.exit(1);
}

const catalog = validateCatalog(root);
if (catalog.errors.length > 0) {
  for (const error of catalog.errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

const {
  SDK_VERSION: sdkVersion,
  TOOL_CATEGORIES: sdkToolCategories,
  TOOL_SCOPES: sdkToolScopes,
} = await import(pathToFileURL(sdkEntry).href);
const policy = readJson(resolve(root, "compatibility.json"));
if (sdkVersion !== policy.targetSdkVersion) {
  console.error(
    `ERROR: compatibility target SDK ${policy.targetSdkVersion} does not match agent SDK ${sdkVersion}`
  );
  process.exit(1);
}

// Legacy plugins resolve host-provided TON dependencies relative to argv[1].
process.argv[1] = realpathSync(agentBin);

const callable = new Proxy(function noop() {}, {
  get: (_target, property) => (property === "then" ? undefined : callable),
  apply: () => callable,
});
const sdk = {
  ton: callable,
  telegram: callable,
  db: callable,
  storage: callable,
  secrets: { get: () => undefined, require: () => "test", has: () => false },
  log: { info() {}, warn() {}, error() {}, debug() {} },
  pluginConfig: {},
  config: {},
  bot: null,
  on() {},
};

const scopes = new Set(sdkToolScopes);
const categories = new Set(sdkToolCategories);
const globalToolNames = new Map();
let toolCount = 0;
let dataToolCount = 0;
let actionToolCount = 0;
const errors = [];

for (const id of pluginDirectories(root)) {
  const manifest = readJson(resolve(root, "plugins", id, "manifest.json"));
  let module;
  try {
    module = await import(pathToFileURL(resolve(root, "plugins", id, "index.js")).href);
  } catch (error) {
    errors.push(`${id}: import failed: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  if (manifest.sdkVersion) {
    if (module.manifest?.name !== id) errors.push(`${id}: runtime manifest name must match ID`);
    if (module.manifest?.version !== manifest.version) {
      errors.push(`${id}: runtime and disk versions differ`);
    }
    if (module.manifest?.sdkVersion !== manifest.sdkVersion) {
      errors.push(`${id}: runtime and disk sdkVersion differ`);
    }
  }

  let tools;
  try {
    tools = typeof module.tools === "function" ? module.tools(sdk) : module.tools;
  } catch (error) {
    errors.push(
      `${id}: tools initialization failed: ${error instanceof Error ? error.message : String(error)}`
    );
    continue;
  }
  if (!Array.isArray(tools)) {
    errors.push(`${id}: tools export must be an array or return one`);
    continue;
  }

  const runtimeNames = [];
  for (const tool of tools) {
    if (!tool || typeof tool !== "object") {
      errors.push(`${id}: non-object tool`);
      continue;
    }
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(tool.name ?? "")) {
      errors.push(`${id}: invalid runtime tool name ${String(tool.name)}`);
    }
    if (
      typeof tool.description !== "string" ||
      tool.description.length === 0 ||
      tool.description.length > 1024
    ) {
      errors.push(`${id}/${tool.name}: invalid runtime description`);
    }
    if (typeof tool.execute !== "function") errors.push(`${id}/${tool.name}: missing execute()`);
    if (
      tool.parameters !== undefined &&
      (!tool.parameters || typeof tool.parameters !== "object" || Array.isArray(tool.parameters))
    ) {
      errors.push(`${id}/${tool.name}: invalid parameters schema`);
    }
    if (!scopes.has(tool.scope)) errors.push(`${id}/${tool.name}: invalid or missing scope`);
    if (!categories.has(tool.category)) errors.push(`${id}/${tool.name}: invalid or missing category`);
    if (tool.requiresApproval !== undefined && typeof tool.requiresApproval !== "boolean") {
      errors.push(`${id}/${tool.name}: requiresApproval must be boolean`);
    }

    const owner = globalToolNames.get(tool.name);
    if (owner) errors.push(`${id}/${tool.name}: duplicates ${owner}`);
    else globalToolNames.set(tool.name, id);
    runtimeNames.push(tool.name);
    toolCount++;
    if (tool.category === "data-bearing") dataToolCount++;
    else actionToolCount++;
  }

  const manifestNames = manifest.tools.map((tool) => tool.name).sort();
  runtimeNames.sort();
  if (JSON.stringify(manifestNames) !== JSON.stringify(runtimeNames)) {
    errors.push(`${id}: runtime tools and manifest tools differ`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `Runtime validation passed against SDK ${sdkVersion}: ${catalog.pluginCount} plugins, ` +
    `${toolCount} tools (${dataToolCount} data, ${actionToolCount} actions)`
);
