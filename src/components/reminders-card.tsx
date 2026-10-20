"use client";

import { useAppData } from "@/lib/store";
import { relDue } from "@/lib/time";
import { useNow } from "@/lib/use-now";
import type { Timer } from "@/lib/types";
import type { TimerPromptInit } from "./timer-sheet";

export default function RemindersCard({
  onFollowup,
}: {
  onFollowup: (init: TimerPromptInit) => void;
}) {
  const { timers, timerDone, timerSnooze, timerCancel } = useAppData();
  const now = useNow();
  const sorted = [...timers].sort(
    (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
  );
  if (!sorted.length) return null;

  const anyDue = sorted.some((t) => new Date(t.due_at).getTime() <= now);

  async function handleDone(t: Timer) {
    const nextStep = t.rest && t.rest.length ? t.rest[0] : null;
    const ok = await timerDone(t);
    if (ok && nextStep) {
      onFollowup({
        routine: t.routine_id ? { id: t.routine_id, name: t.routine_name || "" } : null,
        text: nextStep.text,
        minutes: nextStep.afterMin,
        rest: t.rest.slice(1),
      });
    }
  }

  return (
    <article className="card" style={anyDue ? { borderColor: "var(--grab)" } : undefined}>
      <div className="card-head">
        <h3>Reminders</h3>
        <div className="meta">
          <span>Both of you see these</span>
        </div>
      </div>
      <ul className="tm">
        {sorted.map((t) => {
          const due = new Date(t.due_at).getTime() <= now;
          const next = t.rest && t.rest.length ? t.rest[0] : null;
          return (
            <li key={t.id}>
              <div className="ttext" style={{ padding: 0 }}>
                <b>{t.text}</b>
                <span className={"sub" + (due ? " hand" : "")}>
                  {relDue(t.due_at)}
                  {t.routine_name ? ` \u00b7 from \u201c${t.routine_name}\u201d` : ""}
                </span>
                {next && <span className="sub">Then: {next.text}</span>}
              </div>
              <button
                className={"mini" + (due ? " warm" : "")}
                type="button"
                onClick={() => handleDone(t)}
              >
                Done
              </button>
              <div className="tl">
                <button className="linkbtn" type="button" onClick={() => timerSnooze(t)}>
                  Snooze 15 min
                </button>
                <button className="linkbtn danger" type="button" onClick={() => timerCancel(t)}>
                  Cancel
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
