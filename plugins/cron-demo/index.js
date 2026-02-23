/**
 * Cron Demo plugin — demonstrates sdk.cron for periodic task scheduling.
 *
 * Registers a "hello-world" cron job that sends a greeting to the owner DM
 * at a configurable interval. Shows how to:
 *   - Register cron jobs during tools() phase
 *   - Persist state across restarts (lastRunAt)
 *   - Detect missed runs with runMissed: true
 *   - Manage jobs via tool commands (status, toggle, set interval)
 */

/** @type {string | null} */
let ownerChatId = null;

/** @type {import("@teleton-agent/sdk").PluginSDK | null} */
let _sdk = null;

const DEFAULT_INTERVAL = 60_000; // 1 minute

// ---------------------------------------------------------------------------
// Tool 1: cron_demo_status — show all registered cron jobs
// ---------------------------------------------------------------------------

function makeStatusTool(sdk) {
  return {
    name: "cron_demo_status",
    description: "Show all registered cron jobs from this plugin, including last run time and state.",
    scope: "dm-only",
    parameters: { type: "object", properties: {} },

    execute: async (_params, _context) => {
      if (!sdk.cron) {
        return { success: false, error: "Cron not available (no database)" };
      }

      const jobs = sdk.cron.list();
      if (jobs.length === 0) {
        return { success: true, data: { message: "No cron jobs registered" } };
      }

      return {
        success: true,
        data: {
          jobs: jobs.map((j) => ({
            id: j.id,
            interval: `${j.intervalMs / 1000}s`,
            running: j.running,
            runMissed: j.runMissed,
            lastRunAt: j.lastRunAt ? new Date(j.lastRunAt).toISOString() : "never",
            nextRunAt: j.nextRunAt ? new Date(j.nextRunAt).toISOString() : null,
          })),
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tool 2: cron_demo_set_interval — change the hello-world interval
// ---------------------------------------------------------------------------

function makeSetIntervalTool(sdk) {
  return {
    name: "cron_demo_set_interval",
    description: "Change the interval of the hello-world cron job. Minimum 5 seconds.",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        seconds: {
          type: "integer",
          description: "New interval in seconds (minimum 5)",
          minimum: 5,
        },
      },
      required: ["seconds"],
    },

    execute: async (params, _context) => {
      if (!sdk.cron) {
        return { success: false, error: "Cron not available (no database)" };
      }

      const seconds = params.seconds;
      if (seconds < 5) {
        return { success: false, error: "Interval must be at least 5 seconds" };
      }

      const ms = seconds * 1000;

      // Re-register with the new interval — cron system handles timer swap
      sdk.cron.register("hello-world", { every: ms, runMissed: true }, helloWorldCallback);
      sdk.storage?.set("hello_interval", ms);

      return {
        success: true,
        data: { message: `Interval updated to ${seconds}s`, intervalMs: ms },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tool 3: cron_demo_toggle — enable/disable the cron job
// ---------------------------------------------------------------------------

function makeToggleTool(sdk) {
  return {
    name: "cron_demo_toggle",
    description: "Enable or disable the hello-world cron job.",
    scope: "dm-only",
    parameters: {
      type: "object",
      properties: {
        enabled: {
          type: "boolean",
          description: "true to enable, false to disable",
        },
      },
      required: ["enabled"],
    },

    execute: async (params, _context) => {
      if (!sdk.cron) {
        return { success: false, error: "Cron not available (no database)" };
      }

      if (params.enabled) {
        const interval = sdk.storage?.get("hello_interval") ?? DEFAULT_INTERVAL;
        sdk.cron.register("hello-world", { every: interval, runMissed: true }, helloWorldCallback);
        sdk.storage?.set("hello_enabled", true);
        return { success: true, data: { message: "Hello-world cron enabled" } };
      } else {
        sdk.cron.unregister("hello-world");
        sdk.storage?.set("hello_enabled", false);
        return { success: true, data: { message: "Hello-world cron disabled" } };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Cron callback — sends "Hello, World!" to the owner DM
// ---------------------------------------------------------------------------

async function helloWorldCallback() {
  if (!_sdk || !ownerChatId) {
    _sdk?.log.debug("Skipping hello-world tick: no SDK or owner chat ID");
    return;
  }

  try {
    const now = new Date().toLocaleTimeString();
    await _sdk.telegram.sendMessage(
      ownerChatId,
      `Hello, World! The time is ${now}`
    );
    _sdk.log.info(`Sent hello-world to ${ownerChatId}`);
  } catch (err) {
    _sdk.log.error(`Failed to send hello-world: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// SDK export — tools(sdk) registers the cron job + returns tool defs
// ---------------------------------------------------------------------------

export const manifest = {
  name: "cron-demo",
  version: "1.0.0",
  description: "Demonstrates sdk.cron — periodic hello world messages",
};

export const tools = (sdk) => {
  _sdk = sdk;

  // Register the cron job (timer starts later when plugin-loader calls _start)
  if (sdk.cron) {
    const enabled = sdk.storage?.get("hello_enabled") ?? true;
    if (enabled) {
      const interval = sdk.storage?.get("hello_interval") ?? DEFAULT_INTERVAL;
      sdk.cron.register("hello-world", { every: interval, runMissed: true }, helloWorldCallback);
      sdk.log.info(`Registered hello-world cron (every ${interval / 1000}s)`);
    }
  }

  return [makeStatusTool(sdk), makeSetIntervalTool(sdk), makeToggleTool(sdk)];
};

// ---------------------------------------------------------------------------
// start() — capture the owner chat ID from config for message delivery
// ---------------------------------------------------------------------------

export async function start(ctx) {
  const adminIds = ctx.config?.telegram?.admin_ids;
  ownerChatId = Array.isArray(adminIds) && adminIds.length > 0 ? String(adminIds[0]) : null;
  if (!ownerChatId) {
    ctx.log("cron-demo: no admin_ids in config, hello-world messages won't be sent");
  } else {
    ctx.log(`cron-demo: will send hello-world to admin ${ownerChatId}`);
  }
}
