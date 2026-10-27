import { getDb } from "./db";
import { menuLink, rememberedOrigin } from "./businesses";
import { textStatusCallbackUrl } from "./messaging";
import { sendCampaign } from "./texts";

export const MENU_TEXT_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const WEEKDAYS = MENU_TEXT_WEEKDAYS;

export type MenuTextSchedule = {
  enabled: boolean;
  weekday: number;
  hour: number;
  minute: number;
  timezone: string;
  message: string;
  lastSentOn: string;
};

const DEFAULT_MESSAGE = "This week's menu is ready.";
const DEFAULT_TIMEZONE = "America/Chicago";

function ensureScheduleColumns() {
  const db = getDb();
  const names = new Set(
    (db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[]).map((column) => column.name),
  );
  const add = (column: string, definition: string) => {
    if (!names.has(column)) db.exec(`ALTER TABLE businesses ADD COLUMN ${column} ${definition}`);
  };
  add("menu_text_enabled", "INTEGER NOT NULL DEFAULT 0");
  add("menu_text_weekday", "INTEGER NOT NULL DEFAULT 1");
  add("menu_text_hour", "INTEGER NOT NULL DEFAULT 9");
  add("menu_text_minute", "INTEGER NOT NULL DEFAULT 0");
  add("menu_text_timezone", `TEXT NOT NULL DEFAULT '${DEFAULT_TIMEZONE}'`);
  add("menu_text_message", `TEXT NOT NULL DEFAULT '${DEFAULT_MESSAGE.replace(/'/g, "''")}'`);
  add("menu_text_last_sent", "TEXT NOT NULL DEFAULT ''");
}

export function weekdayName(weekday: number) {
  return WEEKDAYS[weekday] ?? "monday";
}

export function parseWeekday(value: string) {
  const index = WEEKDAYS.indexOf(value.trim().toLowerCase() as (typeof WEEKDAYS)[number]);
  return index >= 0 ? index : null;
}

export function parseClock(value: string) {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const suffix = match[3];
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function getMenuTextSchedule(businessId: number): MenuTextSchedule {
  ensureScheduleColumns();
  const row = getDb()
    .prepare(
      `SELECT menu_text_enabled AS enabled, menu_text_weekday AS weekday, menu_text_hour AS hour,
              menu_text_minute AS minute, menu_text_timezone AS timezone, menu_text_message AS message,
              menu_text_last_sent AS lastSentOn
       FROM businesses WHERE id = ?`,
    )
    .get(businessId) as MenuTextSchedule | undefined;
  if (!row) throw new Error("That business is not on this desk.");
  return {
    enabled: Boolean(row.enabled),
    weekday: row.weekday,
    hour: row.hour,
    minute: row.minute,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    message: row.message || DEFAULT_MESSAGE,
    lastSentOn: row.lastSentOn || "",
  };
}

export function saveMenuTextSchedule(
  businessId: number,
  input: { enabled: boolean; weekday: number; hour: number; minute: number; timezone: string; message: string },
) {
  ensureScheduleColumns();
  if (input.weekday < 0 || input.weekday > 6) throw new Error("Pick a day of the week.");
  if (input.hour < 0 || input.hour > 23 || input.minute < 0 || input.minute > 59) {
    throw new Error("Enter a time like 9:00am.");
  }
  const timezone = input.timezone.trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("That timezone is not recognized. Use America/Chicago.");
  }
  const message = input.message.trim();
  if (message.length < 2 || message.length > 480) throw new Error("Write a message between 2 and 480 characters.");
  getDb()
    .prepare(
      `UPDATE businesses
       SET menu_text_enabled = ?, menu_text_weekday = ?, menu_text_hour = ?, menu_text_minute = ?,
           menu_text_timezone = ?, menu_text_message = ?
       WHERE id = ?`,
    )
    .run(input.enabled ? 1 : 0, input.weekday, input.hour, input.minute, timezone, message, businessId);
  return getMenuTextSchedule(businessId);
}

export function scheduleReport(schedule: MenuTextSchedule) {
  const clock = new Date(2000, 0, 1, schedule.hour, schedule.minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const when = `${weekdayName(schedule.weekday)} at ${clock} ${schedule.timezone}`;
  if (!schedule.enabled) {
    const reason = "It is off because nobody has turned it on. Nothing failed.";
    return {
      status: "off" as const,
      reason,
      summary: `The weekly menu text is off. Reason: ${reason} The stored plan is ${when}. Naming a day and time turns it on.`,
    };
  }
  const reason = `It is on because a day and time are saved: ${when}.`;
  return {
    status: "on" as const,
    reason,
    summary: `The menu text is on for every ${when}. Reason: ${reason} It goes to saved clients and includes the menu link.`,
  };
}

export function describeMenuTextSchedule(schedule: MenuTextSchedule) {
  return scheduleReport(schedule).summary;
}

type LocalStamp = { weekday: number; hour: number; minute: number; date: string };

export function localStamp(now: Date, timeZone: string): LocalStamp {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(pick("weekday"));
  const hour = Number(pick("hour"));
  return {
    weekday,
    hour: hour === 24 ? 0 : hour,
    minute: Number(pick("minute")),
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
  };
}

export function scheduleIsDue(schedule: MenuTextSchedule, now: Date) {
  if (!schedule.enabled) return false;
  const local = localStamp(now, schedule.timezone);
  if (local.weekday !== schedule.weekday || local.date === schedule.lastSentOn) return false;
  const nowMinutes = local.hour * 60 + local.minute;
  const target = schedule.hour * 60 + schedule.minute;
  return nowMinutes >= target && nowMinutes < target + 15;
}

export async function sendDueMenuTexts(now = new Date()) {
  ensureScheduleColumns();
  const rows = getDb().prepare("SELECT id, slug FROM businesses WHERE menu_text_enabled = 1").all() as {
    id: number;
    slug: string;
  }[];
  const sent: { businessId: number; recipientCount: number }[] = [];
  for (const business of rows) {
    const schedule = getMenuTextSchedule(business.id);
    if (!scheduleIsDue(schedule, now)) continue;
    const local = localStamp(now, schedule.timezone);
    getDb().prepare("UPDATE businesses SET menu_text_last_sent = ? WHERE id = ?").run(local.date, business.id);
    const origin = rememberedOrigin(business.id) || undefined;
    const result = await sendCampaign({
      businessId: business.id,
      message: schedule.message,
      linkUrl: menuLink(business.slug, origin),
      includeCustomers: true,
      includeCompanyContacts: false,
      statusCallbackUrl: textStatusCallbackUrl(origin),
    });
    sent.push({ businessId: business.id, recipientCount: result.recipientCount });
  }
  return sent;
}

export function startMenuTextClock() {
  const globalForClock = globalThis as { menuTextClock?: boolean };
  if (globalForClock.menuTextClock) return;
  globalForClock.menuTextClock = true;
  setInterval(() => {
    void sendDueMenuTexts().catch((error) => {
      console.error("Weekly menu text failed", error);
    });
  }, 60_000);
}
