import { defineConfig } from "@trigger.dev/sdk";

// Set TRIGGER_PROJECT_REF in `.env` to your ref from
// cloud.trigger.dev → Project settings (e.g. proj_abc123).
const project = process.env.TRIGGER_PROJECT_REF ?? "proj_replace_me";

export default defineConfig({
  project,
  runtime: "node",
  logLevel: "info",
  maxDuration: 3600,
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
});
