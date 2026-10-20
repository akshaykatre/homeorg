import type { ActivityItem } from "@/lib/types";

export function ago(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return m + " min ago";
  if (m < 1440) return Math.floor(m / 60) + " h ago";
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function eventText(
  a: ActivityItem,
  nameOf: (id: string | null | undefined) => string,
  isMe: (id: string | null | undefined) => boolean,
) {
  const who = nameOf(a.by);
  const me = isMe(a.by);
  const s = `\u201c${a.subject}\u201d`;
  switch (a.type) {
    case "took":
      return `${who} picked up ${s}`;
    case "done":
      return `${who} finished ${s}`;
    case "help":
      return `${who} ${me ? "are" : "is"} helping with ${s}`;
    case "hand":
      return `${who} ${me ? "asked for a hand with " : "could use a hand with "}${s}`;
    case "claim":
      return `${who} took on ${s}`;
    case "lead":
      return `${who} took the lead on ${s}`;
    case "timerset":
      return `${who} set a reminder: ${s} in ${a.extra}`;
    case "timerdone":
      return `${who} marked ${s} as done${a.extra ? `. Next: ${a.extra}` : ""}`;
    default:
      return `${who} updated ${s}`;
  }
}
