import { getDb } from "./db.ts";
import { localStamp } from "./menu-schedule.ts";

export const DELIVERY_TIMEZONE = "America/Chicago";

export type DeliveryWeekday = "Monday" | "Thursday";

export type DeliveryChoice = {
  date: string;
  weekday: DeliveryWeekday;
  label: string;
  deadlineLabel: string;
};

const WEEKDAY: Record<DeliveryWeekday, number> = { Monday: 1, Thursday: 4 };

export function deliveryChoices(now = new Date(), skipped: ReadonlySet<string> = new Set()): DeliveryChoice[] {
  const today = localStamp(now, DELIVERY_TIMEZONE).date;
  const choices: DeliveryChoice[] = [];
  for (const weekday of ["Monday", "Thursday"] as const) {
    for (let offset = 0; offset < 21; offset += 1) {
      const date = addCalendarDays(today, offset);
      if (weekdayIndex(date) !== WEEKDAY[weekday]) continue;
      if (skipped.has(date)) continue;
      if (now.getTime() > deadlineInstant(date).getTime()) continue;
      choices.push({
        date,
        weekday,
        label: formatDeliveryDate(date),
        deadlineLabel: `${formatDeliveryDate(addCalendarDays(date, -1))} at noon`,
      });
      break;
    }
  }
  return choices.sort((a, b) => a.date.localeCompare(b.date));
}

export function staffDeliveryDates(now = new Date()) {
  const today = localStamp(now, DELIVERY_TIMEZONE).date;
  const dates: { date: string; weekday: DeliveryWeekday; label: string }[] = [];
  for (const weekday of ["Monday", "Thursday"] as const) {
    let found = 0;
    for (let offset = 0; offset < 42 && found < 3; offset += 1) {
      const date = addCalendarDays(today, offset);
      if (weekdayIndex(date) !== WEEKDAY[weekday]) continue;
      if (now.getTime() > deadlineInstant(date).getTime()) continue;
      dates.push({ date, weekday, label: formatDeliveryDate(date) });
      found += 1;
    }
  }
  return dates.sort((a, b) => a.date.localeCompare(b.date));
}

export function isDeliveryWeekday(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const day = weekdayIndex(isoDate);
  return day === WEEKDAY.Monday || day === WEEKDAY.Thursday;
}

export function formatDeliveryDate(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function openDeliveryChoice(date: string, now = new Date(), skipped: ReadonlySet<string> = new Set()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return deliveryChoices(now, skipped).find((choice) => choice.date === date) ?? null;
}

export function deliveryDateError(date: string, now = new Date(), skipped: ReadonlySet<string> = new Set()) {
  if (!date.trim()) return "Pick a delivery date.";
  if (skipped.has(date)) return "That delivery day is not available. Choose another day.";
  if (openDeliveryChoice(date, now, skipped)) return null;
  return "That delivery date is closed. Monday orders close Sunday at noon, and Thursday orders close Wednesday at noon.";
}

function ensureSkippedTable() {
  getDb().exec(
    `CREATE TABLE IF NOT EXISTS skipped_delivery_dates (
      business_id INTEGER NOT NULL,
      delivery_date TEXT NOT NULL,
      PRIMARY KEY (business_id, delivery_date)
    )`,
  );
}

export function skippedDeliveryDates(businessId: number) {
  ensureSkippedTable();
  const rows = getDb()
    .prepare("SELECT delivery_date AS date FROM skipped_delivery_dates WHERE business_id = ?")
    .all(businessId) as { date: string }[];
  return new Set(rows.map((row) => row.date));
}

export function setDeliveryDateSkipped(businessId: number, date: string, skipped: boolean) {
  if (!isDeliveryWeekday(date)) return false;
  ensureSkippedTable();
  const db = getDb();
  if (skipped) {
    db.prepare(
      "INSERT OR IGNORE INTO skipped_delivery_dates (business_id, delivery_date) VALUES (?, ?)",
    ).run(businessId, date);
  } else {
    db.prepare("DELETE FROM skipped_delivery_dates WHERE business_id = ? AND delivery_date = ?").run(
      businessId,
      date,
    );
  }
  return true;
}

function deadlineInstant(deliveryDate: string) {
  return chicagoWallTime(addCalendarDays(deliveryDate, -1), 12, 0);
}

function weekdayIndex(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addCalendarDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function chicagoWallTime(isoDate: string, hour: number, minute: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour + 6, minute);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const stamp = localStamp(new Date(utc), DELIVERY_TIMEZONE);
    const [gotYear, gotMonth, gotDay] = stamp.date.split("-").map(Number);
    const got = Date.UTC(gotYear, gotMonth - 1, gotDay, stamp.hour, stamp.minute);
    const want = Date.UTC(year, month - 1, day, hour, minute);
    if (got === want) return new Date(utc);
    utc += want - got;
  }
  return new Date(utc);
}
