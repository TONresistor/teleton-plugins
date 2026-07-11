import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SECTION_PREFIX = "teleton-catalog";

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function pluginDirectories(root = process.cwd()) {
  const pluginsDir = join(root, "plugins");
  return readdirSync(pluginsDir)
    .filter((name) => existsSync(join(pluginsDir, name, "manifest.json")))
    .sort();
}

export function readCatalog(root = process.cwd()) {
  const compatibility = readJson(join(root, "compatibility.json"));
  const directories = pluginDirectories(root);
  const manifests = new Map(
    directories.map((id) => [id, readJson(join(root, "plugins", id, "manifest.json"))])
  );
  return { compatibility, directories, manifests };
}

export function buildRegistry(root = process.cwd()) {
  const { compatibility, directories, manifests } = readCatalog(root);
  return {
    version: compatibility.targetSdkVersion,
    plugins: directories
      .filter((id) => compatibility.plugins[id]?.marketplace === true)
      .map((id) => {
        const manifest = manifests.get(id);
        return {
          id,
          name: manifest.name ?? "",
          description: manifest.description ?? "",
          author: manifest.author?.name ?? "",
          tags: Array.isArray(manifest.tags) ? manifest.tags : [],
          path: `plugins/${id}`,
        };
      }),
  };
}

export function serializeRegistry(root = process.cwd()) {
  return `${JSON.stringify(buildRegistry(root), null, 2)}\n`;
}

export function renderReadme(root = process.cwd(), source = readFileSync(join(root, "README.md"), "utf8")) {
  const { compatibility, directories, manifests } = readCatalog(root);
  const marketplace = directories.filter((id) => compatibility.plugins[id]?.marketplace === true);
  const supported = directories.filter((id) => compatibility.plugins[id]?.status === "supported");
  const quarantined = directories.filter((id) => compatibility.plugins[id]?.status === "quarantined");
  const sdkMajor = compatibility.targetSdkVersion.split(".")[0];
  const countTools = (id) => {
    const tools = manifests.get(id).tools;
    return Array.isArray(tools) ? tools.length : 0;
  };
  const toolCount = directories.reduce((total, id) => total + countTools(id), 0);
  const exampleCount = supported.length - marketplace.length;

  const badges = [
    `[![SDK](https://img.shields.io/badge/SDK-v${sdkMajor}-00C896.svg)](https://www.npmjs.com/package/@teleton-agent/sdk)`,
    `[![Marketplace](https://img.shields.io/badge/marketplace-${marketplace.length}-8B5CF6.svg)](#sdk-v${sdkMajor}-marketplace)`,
    `[![Catalog](https://img.shields.io/badge/catalog-${directories.length}_plugins-E040FB.svg)](compatibility.json)`,
  ].join("\n");

  const summary = [
    "| Status | Plugins | Meaning |",
    "|---|---:|---|",
    `| SDK v${sdkMajor} supported | ${supported.length} | Loads against SDK v${sdkMajor}; ${marketplace.length} marketplace plugins plus ${exampleCount} examples |`,
    `| Quarantined | ${quarantined.length} | Preserved in source, rejected by SDK v2 and excluded from the marketplace |`,
    `| Total | ${directories.length} | ${toolCount} tools |`,
  ].join("\n");

  const marketplaceTable = [
    `## SDK v${sdkMajor} marketplace`,
    "",
    "| Plugin | Tools | Description |",
    "|---|---:|---|",
    ...marketplace.map((id) => {
      const manifest = manifests.get(id);
      return `| [${escapeMarkdown(id)}](plugins/${id}/) | ${countTools(id)} | ${escapeMarkdown(manifest.description ?? "")} |`;
    }),
  ].join("\n");

  const quarantineTable = [
    "| Plugin | Blocker |",
    "|---|---|",
    ...quarantined.map(
      (id) => `| \`${escapeMarkdown(id)}\` | ${escapeMarkdown(compatibility.plugins[id]?.reason ?? "")} |`
    ),
  ].join("\n");

  return replaceSection(
    replaceSection(
      replaceSection(replaceSection(source, "badges", badges), "summary", summary),
      "marketplace",
      marketplaceTable
    ),
    "quarantine",
    quarantineTable
  );
}

export function generatedArtifacts(root = process.cwd()) {
  return new Map([
    [join(root, "registry.json"), serializeRegistry(root)],
    [join(root, "README.md"), renderReadme(root)],
  ]);
}

function replaceSection(source, name, body) {
  const start = `<!-- ${SECTION_PREFIX}:${name}:start -->`;
  const end = `<!-- ${SECTION_PREFIX}:${name}:end -->`;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  const duplicateStart = startIndex !== -1 && source.indexOf(start, startIndex + start.length) !== -1;
  const duplicateEnd = endIndex !== -1 && source.indexOf(end, endIndex + end.length) !== -1;
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex || duplicateStart || duplicateEnd) {
    throw new Error(`README generated section is missing or malformed: ${name}`);
  }
  const contentStart = startIndex + start.length;
  return `${source.slice(0, contentStart)}\n${body}\n${source.slice(endIndex)}`;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll(/\s+/g, " ").trim();
}
