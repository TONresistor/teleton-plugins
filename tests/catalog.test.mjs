import assert from "node:assert/strict";
import test from "node:test";
import { validateCatalog } from "../scripts/catalog-lib.mjs";

test("catalog, manifests, compatibility policy and registry stay synchronized", () => {
  const result = validateCatalog();
  assert.deepEqual(result.errors, []);
  assert.equal(result.pluginCount, 26);
  assert.equal(result.toolCount, 191);
  assert.equal(result.supportedCount, 14);
  assert.equal(result.quarantinedCount, 12);
  assert.equal(result.marketplaceCount, 12);
});
