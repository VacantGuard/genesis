import { saveWeeklyMenuTextAction } from "@/lib/business-actions";
import { MENU_TEXT_WEEKDAYS, weekdayName, type MenuTextSchedule } from "@/lib/menu-schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function WeeklyTextForm({ schedule }: { schedule: MenuTextSchedule }) {
  const time = `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;

  return (
    <form action={saveWeeklyMenuTextAction} className="grid max-w-xl gap-3">
      <h2 className="font-heading text-2xl tracking-tight">Weekly menu text</h2>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Message</span>
        <Textarea
          name="message"
          required
          minLength={2}
          maxLength={480}
          defaultValue={schedule.message}
          className="min-h-24 bg-card"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Send day</span>
          <select
            name="weekday"
            defaultValue={weekdayName(schedule.weekday)}
            className="h-10 rounded-md border bg-card px-3 text-sm"
          >
            {MENU_TEXT_WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Send time</span>
          <Input type="time" name="time" required defaultValue={time} className="h-10 bg-card" />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Times use {schedule.timezone}. The menu link is added when the text sends. Saving keeps this
        weekly text on.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="turnOff" value="off" className="mt-1 size-4" />
        <span>Turn the weekly menu text off</span>
      </label>
      <div>
        <Button type="submit">Save weekly menu text</Button>
      </div>
    </form>
  );
}
