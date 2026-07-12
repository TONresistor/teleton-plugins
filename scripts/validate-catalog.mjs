import { validateCatalog } from "./catalog-lib.mjs";

const result = validateCatalog();
if (result.errors.length > 0) {
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `Catalog valid: ${result.pluginCount} plugins, ${result.toolCount} tools, ` +
    `${result.supportedCount} SDK v2 supported, ${result.quarantinedCount} quarantined, ` +
    `${result.marketplaceCount} listed`
);
