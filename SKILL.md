---
name: teleton-plugin-builder
description: Build and maintain Teleton plugins that comply with the SDK v2 capability and marketplace policy.
---

# Teleton Plugin Builder

Use this workflow when creating or updating a plugin in this repository.

## Read first

Before editing, read:

1. [`CONTRIBUTING.md`](CONTRIBUTING.md) for the normative contract.
2. [`compatibility.json`](compatibility.json) for the current SDK policy.
3. [`plugins/example/index.js`](plugins/example/index.js) for a static tool.
4. [`plugins/example-sdk/index.js`](plugins/example-sdk/index.js) for an SDK v2 plugin.
5. [`references/patterns.md`](references/patterns.md) for safe implementation patterns.

The public API is defined by `@teleton-agent/sdk@^2`. Do not infer APIs from old plugins.

## Workflow

1. Inspect the requested plugin, related manifests and existing tool names.
2. Choose a static `tools` array or `tools(sdk)`.
3. State the proposed tools, parameters, scopes, categories, secrets and side effects.
4. Implement `index.js`, `manifest.json` and `README.md`.
5. Add a `package.json` and lockfile only when external dependencies are necessary.
6. Add or update the plugin's `compatibility.json` entry.
7. Run `npm run generate`; supported production-ready plugins enter `registry.json` automatically.
8. Run the full repository validation commands.

## Choose the plugin pattern

Use a static `tools` array when the plugin only performs local computation or calls an external API
without Teleton state, Telegram actions, wallet operations, secrets or persistence.

Use `tools(sdk)` when the plugin needs any public SDK capability:

- `sdk.telegram`;
- `sdk.ton`;
- `sdk.secrets`;
- `sdk.storage` or `sdk.db`;
- `sdk.pluginConfig`;
- `sdk.log`;
- lifecycle or bot capabilities declared by the SDK.

## Mandatory SDK v2 rules

- SDK plugins declare `sdkVersion: "^2.0.0"` in both runtime and disk manifests.
- Every tool declares `scope` and `category`.
- Action tools are safe under retry and compatible with explicit owner approval.
- Secrets are declared and accessed through `sdk.secrets`.
- State is stored only through the isolated plugin database or storage SDK.
- External requests have timeouts and bounded inputs and outputs.
- Tool errors never expose credentials, wallet data or unbounded upstream payloads.

Never use:

- `sdk.telegram.getRawClient()`;
- `context.bridge` or `ctx.bridge`;
- direct GramJS access through Teleton internals;
- `wallet.json`, mnemonic reads or direct signing;
- private Teleton modules as an undeclared API;
- global environment variables for secrets.

If the SDK lacks a required capability, do not create an escape hatch. Preserve the plugin as
`quarantined`, set its range to `^1.0.0`, explain the blocker in `compatibility.json`, and keep it out
of the generated `registry.json`.

## Minimal SDK v2 template

```js
export const manifest = {
  name: "my-plugin",
  version: "1.0.0",
  sdkVersion: "^2.0.0",
  description: "Describe the capability",
};

export const tools = (sdk) => [
  {
    name: "my_plugin_lookup",
    description: "Look up a value without changing external state",
    scope: "always",
    category: "data-bearing",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 200 },
      },
      required: ["query"],
    },
    async execute(params) {
      try {
        const response = await fetch(
          `https://api.example.com/search?q=${encodeURIComponent(params.query)}`,
          { signal: AbortSignal.timeout(15_000) }
        );
        if (!response.ok) return { success: false, error: `Upstream returned ${response.status}` };
        return { success: true, data: await response.json() };
      } catch (error) {
        sdk.log.warn("Lookup failed");
        return { success: false, error: String(error?.message ?? error).slice(0, 500) };
      }
    },
  },
];
```

## Required validation

Run from the repository root with `../teleton-agent` available:

```bash
npm ci --ignore-scripts
npm run install:plugins
npm run generate
npm run validate
npm test
npm --prefix ../teleton-agent run build:sdk
npm run validate:runtime
npm run audit:plugins
```

Do not claim completion if any command fails. Do not push, publish or install into a live agent unless
the user explicitly requests it.
