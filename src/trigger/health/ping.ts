import { task } from "@trigger.dev/sdk";

/**
 * Smoke-test task used while wiring Trigger.dev.
 * Trigger with an empty payload once `npm run trigger:dev` is connected.
 */
export const healthPing = task({
  id: "health-ping",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: { note?: string } = {}) => {
    const note = payload.note?.trim() || "ok";
    console.log(`health-ping: ${note}`);
    return {
      status: "ok" as const,
      note,
      at: new Date().toISOString(),
    };
  },
});
