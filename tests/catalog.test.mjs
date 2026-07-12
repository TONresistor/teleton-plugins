import assert from "node:assert/strict";
import test from "node:test";
import { validateCatalog } from "../scripts/catalog-lib.mjs";

test("catalog, manifests, compatibility policy and registry stay synchronized", () => {
  const result = validateCatalog();
  assert.deepEqual(result.errors, []);
  assert.equal(result.supportedCount + result.quarantinedCount, result.pluginCount);
  assert.ok(result.pluginCount > 0);
  assert.ok(result.toolCount > 0);
  assert.ok(result.marketplaceCount <= result.supportedCount);
});
