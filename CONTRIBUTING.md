# Contributing to teleton-plugins

This repository accepts plugins that comply with the Teleton SDK v2 capability model. A plugin is
not marketplace-ready merely because its JavaScript imports successfully: its manifest, tool
contract, dependency tree and security boundaries must all pass the repository validators.

## Requirements

- Node `^22.22.2`, `^24.15.0`, or `>=26.0.0`.
- ESM JavaScript only.
- `index.js`, `manifest.json` and `README.md` in each plugin directory.
- `package-lock.json` whenever `package.json` exists.
- Strict semver versions.
- `scope` and `category` on every tool.
- Public SDK capabilities only.

## Supported plugin structure

```text
plugins/my-plugin/
├── index.js
├── manifest.json
├── README.md
├── package.json       # optional
└── package-lock.json  # required with package.json
```

### Runtime manifest

SDK plugins must export a runtime manifest from `index.js`:

```js
export const manifest = {
  name: "my-plugin",
  version: "1.0.0",
  sdkVersion: "^2.0.0",
  description: "One concise sentence",
  defaultConfig: {},
  secrets: {
    api_key: {
      required: false,
      description: "API key for the upstream service",
    },
  },
};
```

The runtime and disk manifests must declare the same version and SDK range. A plugin that does not
use the SDK may omit `sdkVersion` in both places.

### Marketplace manifest

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "One concise sentence",
  "author": { "name": "author", "url": "https://github.com/author" },
  "license": "MIT",
  "entry": "index.js",
  "teleton": ">=0.9.0",
  "sdkVersion": "^2.0.0",
  "tools": [
    { "name": "my_plugin_lookup", "description": "Look up an item" }
  ],
  "permissions": [],
  "tags": ["utility"]
}
```

The directory name, manifest `id`, runtime manifest `name`, compatibility entry and registry ID must
match.

## Tool contract

```js
export const tools = (sdk) => [
  {
    name: "my_plugin_lookup",
    description: "Look up an item without changing external state",
    scope: "always",
    category: "data-bearing",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Item to look up" },
      },
      required: ["query"],
    },
    async execute(params) {
      try {
        const response = await fetch(
          `https://api.example.com/items?q=${encodeURIComponent(params.query)}`,
          { signal: AbortSignal.timeout(15_000) }
        );
        if (!response.ok) return { success: false, error: `Upstream returned ${response.status}` };
        return { success: true, data: await response.json() };
      } catch (error) {
        return { success: false, error: String(error?.message ?? error).slice(0, 500) };
      }
    },
  },
];
```

Rules:

- Tool names match `^[a-z][a-z0-9_]{0,63}$` and are globally unique.
- `scope` is one of the SDK v2 values: `open`, `always`, `dm-only`, `group-only`,
  `admin-only`, `allowlist`, or `disabled`.
- `category` is `data-bearing` for reads or `action` for side effects.
- Parameters use JSON Schema and bound arrays, strings, amounts and result counts.
- Network calls use explicit timeouts and bounded response handling.
- Returned errors are concise and do not include credentials or large upstream bodies.
- Actions must remain safe under retry and require Teleton's explicit approval flow.

## SDK v2 boundaries

Use only APIs declared by `@teleton-agent/sdk@^2`. The canonical reference is the
[SDK package README](https://github.com/TONresistor/teleton-agent/blob/dev/packages/sdk/README.md).

Forbidden:

- `sdk.telegram.getRawClient()`;
- `context.bridge`, `ctx.bridge`, or private bridge/client traversal;
- direct imports of Teleton's private runtime modules;
- direct reads of `wallet.json`, wallet mnemonics or authentication stores;
- arbitrary filesystem access to Teleton state;
- secrets from global environment variables.

Use instead:

- `sdk.telegram` for supported Telegram operations;
- `sdk.ton` for supported wallet and TON operations;
- `sdk.secrets` for declared credentials;
- `sdk.storage` or the isolated `sdk.db` for state;
- `sdk.pluginConfig` for plugin-specific configuration;
- `sdk.log` for structured logs.

If the public SDK lacks a required capability, do not bypass it. Mark the plugin quarantined in
`compatibility.json` and keep it out of `registry.json` until a safe capability exists.

## Lifecycle

Optional exports are `migrate`, `start`, `stop`, `onMessage`, and `onCallbackQuery`.

- `migrate(db)` receives only the plugin's isolated database.
- `start(ctx)` receives `sdk`, isolated `db`, sanitized `config`, `pluginConfig`, and `log`.
- Raw bridge access is not available.
- Cleanup timers and resources in `stop()`.

## Secrets

Declare secrets in the runtime manifest and read them through `sdk.secrets`:

```js
const token = sdk.secrets.get("api_key");
if (!token) return { success: false, error: "API key is not configured" };
```

Never commit credentials, log them, include them in tool results, or read unrelated process
environment variables.

## Dependencies

Plugin dependencies are installed with lifecycle scripts disabled:

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

Commit the generated lockfile. HIGH or CRITICAL audit findings block CI, including for quarantined
plugins retained in the repository.

## Compatibility and registry policy

Every plugin has exactly one entry in [`compatibility.json`](compatibility.json):

- `supported`: validated against SDK v2;
- `quarantined`: preserved but deliberately incompatible with SDK v2;
- `marketplace: true`: allowed only for supported production plugins.

`registry.json` is the generated installable marketplace, not an archive. Examples and quarantined
plugins do not belong there. Never edit it or the generated README catalog sections manually; after
changing a manifest or `compatibility.json`, run:

```bash
npm run generate
```

## Required local checks

With `teleton-agent` checked out as `../teleton-agent`:

```bash
npm ci --ignore-scripts
npm run install:plugins
npm run validate
npm test
npm --prefix ../teleton-agent run build:sdk
npm run validate:runtime
npm run audit:plugins
```

CI repeats these checks using the current `teleton-agent` `dev` branch on Node 22 and Node 24.

## Pull request checklist

- [ ] Plugin ID and tool names are globally unique.
- [ ] Runtime and disk manifests agree.
- [ ] Every tool has a valid scope, category and bounded schema.
- [ ] No raw Telegram client, bridge, wallet file or mnemonic access.
- [ ] Secrets are declared and use `sdk.secrets`.
- [ ] Dependency lockfile is committed and audit is clean.
- [ ] README documents configuration, tools and side effects.
- [ ] `compatibility.json` is updated.
- [ ] `npm run generate` updated the generated registry and README sections.
- [ ] All required local checks pass.
