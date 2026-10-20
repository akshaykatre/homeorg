import type { FollowupStep } from "./types";

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export const STEP_PRESETS: Record<string, FollowupStep[]> = {
  laundry: [
    { text: "Start the dryer", afterMin: 120 },
    { text: "Fold the clothes", afterMin: 90 },
  ],
  dishwasher: [{ text: "Unload the dishwasher", afterMin: 150 }],
};

export function presetFollowups(name: string): FollowupStep[] {
  const n = name.toLowerCase();
  for (const key of Object.keys(STEP_PRESETS)) {
    if (n.includes(key)) return STEP_PRESETS[key].map((s) => ({ ...s }));
  }
  return [];
}

export function fmtDur(min: number) {
  min = Math.max(0, Math.round(min));
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + " h" + (m ? " " + m + " min" : "");
}

export function relDue(dueAtIso: string) {
  const diff = Math.ceil((new Date(dueAtIso).getTime() - Date.now()) / 60000);
  if (diff > 0) return "in " + fmtDur(diff);
  return diff > -1 ? "Due now" : "Due " + fmtDur(-diff) + " ago";
}

export function daysLabel(days: number[]) {
  const d = [...(days || [])].sort();
  if (d.length === 7) return "Every day";
  if (d.join() === "1,2,3,4,5") return "Weekdays";
  if (d.join() === "0,6") return "Weekends";
  return DAY_ORDER.filter((x) => d.includes(x))
    .map((x) => DAY_SHORT[x])
    .join(", ");
}

export function followSummary(f: { text: string; afterMin: number }[]) {
  return f.map((s) => s.text + " after " + fmtDur(s.afterMin)).join(", then ");
}

export function tpTime(min: number) {
  return new Date(Date.now() + min * 60000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
