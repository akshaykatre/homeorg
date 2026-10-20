"use client";

import { useState } from "react";
import Sheet from "./sheet";
import { useAppData } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { fmtDur, tpTime } from "@/lib/time";
import type { FollowupStep } from "@/lib/types";

const CHIPS = [15, 30, 60, 90, 120, 180, 240];

export type TimerPromptInit = {
  routine: { id: string; name: string } | null;
  text: string;
  minutes: number;
  rest: FollowupStep[];
};

export default function TimerSheet({
  init,
  onClose,
}: {
  init: TimerPromptInit;
  onClose: () => void;
}) {
  const { createTimer } = useAppData();
  const toast = useToast();
  const [text, setText] = useState(init.text);
  const [minutes, setMinutes] = useState(init.minutes);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  const title = init.routine ? "Set the next reminder" : "Set a reminder";
  const intro = init.routine
    ? `\u201c${init.routine.name}\u201d is under way. When should we remind you about the next step?`
    : "Both of you see this reminder and get a pop-up when it is due.";

  async function handleSet() {
    const t = text.trim();
    const min = Math.round(minutes);
    if (!t) {
      toast("Say what the reminder is for.");
      return;
    }
    if (!(min > 0) || min > 10080) {
      toast("Pick a time between 1 minute and 7 days.");
      return;
    }
    setBusy(true);
    const ok = await createTimer(init.routine, { text: t, afterMin: min }, init.rest);
    setBusy(false);
    if (ok) {
      toast(`Reminder set: ${t} in ${fmtDur(min)}`);
      onClose();
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="lede">{intro}</p>
      <div className="rform">
        <div className="label">Remind us to</div>
        <input
          maxLength={80}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="For example: Start the dryer"
          aria-label="What to be reminded about"
        />
        <div className="label">In how long?</div>
        <div className="days" role="group" aria-label="Time">
          {CHIPS.map((m) => (
            <button
              key={m}
              className="dchip"
              type="button"
              aria-pressed={!custom && minutes === m}
              onClick={() => {
                setMinutes(m);
                setCustom("");
              }}
            >
              {fmtDur(m)}
            </button>
          ))}
        </div>
        <div className="row">
          <input
            inputMode="numeric"
            maxLength={4}
            value={custom}
            onChange={(e) => {
              const v = e.target.value;
              setCustom(v);
              const n = parseInt(v, 10);
              if (n > 0) setMinutes(n);
            }}
            placeholder="Or type minutes"
            aria-label="Custom minutes"
            style={{ maxWidth: "11rem" }}
          />
          <span className="hint">That is around {tpTime(minutes)}.</span>
        </div>
        {init.rest.length > 0 && (
          <p className="hint">
            After this one: {init.rest.map((x) => x.text).join(", then ")}.
          </p>
        )}
        <div className="row">
          <button className="btn primary" type="button" disabled={busy} onClick={handleSet}>
            Set reminder
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            {init.routine ? "No reminder" : "Cancel"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
