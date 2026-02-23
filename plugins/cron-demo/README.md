# Cron Demo

Demonstrates `sdk.cron` — the interval-based job scheduler added in Teleton SDK v1.0.0.

Registers a periodic cron job that sends "Hello, World!" to the owner DM at a configurable interval. Shows how to register jobs, detect missed runs, and manage them via tools.

## Tools

| Tool | Description | Scope |
|------|-------------|-------|
| `cron_demo_status` | Show all cron jobs and their state | DM only |
| `cron_demo_set_interval` | Change the hello-world interval | DM only |
| `cron_demo_toggle` | Enable or disable the cron job | DM only |

## Installation

```bash
cp -r plugins/cron-demo ~/.teleton/plugins/cron-demo
```

Restart Teleton to load the plugin.

## Usage

The plugin automatically registers a cron job that sends "Hello, World!" every 60 seconds to the owner DM.

**Check status:**
> "Show me the cron jobs"

**Change interval:**
> "Set the hello-world cron to every 30 seconds"

**Disable:**
> "Disable the hello-world cron"

## How It Works

1. During `tools(sdk)`, the plugin calls `sdk.cron.register("hello-world", ...)` with a 60s interval
2. The cron system persists `lastRunAt` in SQLite — if the agent restarts and a run was missed, it fires immediately (`runMissed: true`)
3. The interval and enabled state are persisted via `sdk.storage` so settings survive restarts
4. Tools let the user inspect, reconfigure, and toggle the job at runtime

## Requirements

- Teleton >= 0.8.0
- SDK >= 1.0.0 (with `sdk.cron` support)