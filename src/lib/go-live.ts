const TIMEZONE = "America/Chicago";
const GO_LIVE_DATE = "2026-11-03";
const GO_LIVE_MINUTES = 11 * 60;

export const GO_LIVE_MESSAGE =
  "The site will go live Tuesday at 11:00am Central! At 11:00am you can log in.";

function chicagoParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(pick("hour"));
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    minutes: (hour === 24 ? 0 : hour) * 60 + Number(pick("minute")),
  };
}

/** True at and after Tuesday, November 3, 2026 at 11:00am America/Chicago. */
export function deskIsOpen(now = new Date()) {
  const stamp = chicagoParts(now);
  if (stamp.date > GO_LIVE_DATE) return true;
  if (stamp.date < GO_LIVE_DATE) return false;
  return stamp.minutes >= GO_LIVE_MINUTES;
}
