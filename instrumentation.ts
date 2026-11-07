export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMenuTextClock } = await import("./src/lib/menu-schedule");
  startMenuTextClock();
}
