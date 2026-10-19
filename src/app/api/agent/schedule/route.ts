import { NextResponse } from "next/server";
import { businessForAgentToken } from "@/lib/agent";
import {
  getMenuTextSchedule,
  parseClock,
  parseWeekday,
  saveMenuTextSchedule,
  scheduleReport,
  weekdayName,
} from "@/lib/menu-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function schedulePayload(businessName: string, schedule: ReturnType<typeof getMenuTextSchedule>) {
  const report = scheduleReport(schedule);
  return {
    business: businessName,
    status: report.status,
    reason: report.reason,
    summary: report.summary,
    weekday: weekdayName(schedule.weekday),
    time: `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`,
    timezone: schedule.timezone,
    message: schedule.message,
  };
}

function businessFromRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return businessForAgentToken(token);
}

export async function GET(request: Request) {
  const business = businessFromRequest(request);
  if (!business) {
    return NextResponse.json({ error: "That agent token does not match this business." }, { status: 401 });
  }
  const schedule = getMenuTextSchedule(business.id);
  return NextResponse.json(schedulePayload(business.name, schedule));
}

export async function POST(request: Request) {
  const business = businessFromRequest(request);
  if (!business) {
    return NextResponse.json({ error: "That agent token does not match this business." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    enabled?: unknown;
    weekday?: unknown;
    time?: unknown;
    timezone?: unknown;
    message?: unknown;
  } | null;
  const current = getMenuTextSchedule(business.id);
  const weekdayText = typeof body?.weekday === "string" ? body.weekday.trim() : "";
  const timeText = typeof body?.time === "string" ? body.time.trim() : "";
  const weekday = weekdayText ? parseWeekday(weekdayText) : current.weekday;
  const clock = timeText ? parseClock(timeText) : { hour: current.hour, minute: current.minute };
  if (weekday === null || !clock) {
    return NextResponse.json({ error: "Use a weekday like monday and a time like 9:00am." }, { status: 400 });
  }
  const enabledText = typeof body?.enabled === "string" ? body.enabled.trim().toLowerCase() : "";
  const turnOff = enabledText === "off" && !weekdayText && !timeText;
  const turnOn = Boolean(weekdayText || timeText) || enabledText === "on";
  const enabled = turnOn ? true : turnOff ? false : current.enabled;
  try {
    const schedule = saveMenuTextSchedule(business.id, {
      enabled,
      weekday,
      hour: clock.hour,
      minute: clock.minute,
      timezone: typeof body?.timezone === "string" && body.timezone.trim() ? body.timezone : current.timezone,
      message: typeof body?.message === "string" && body.message.trim() ? body.message : current.message,
    });
    return NextResponse.json(schedulePayload(business.name, schedule));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The schedule could not be saved.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
