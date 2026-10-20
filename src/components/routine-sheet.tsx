"use client";

import { useState } from "react";
import Sheet from "./sheet";
import { useAppData } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { DAY_ORDER, DAY_SHORT, fmtDur, STEP_PRESETS } from "@/lib/time";
import type { FollowupStep } from "@/lib/types";

const MIN_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 360, 480];

export default function RoutineSheet({ onClose }: { onClose: () => void }) {
  const { createRoutine, meId, otherIds, nameOf } = useAppData();
  const toast = useToast();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<string>("me");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [steps, setSteps] = useState<FollowupStep[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function ownerOptions() {
    const opts = [{ v: "me", l: "Owner: You" }];
    otherIds().forEach((id) => opts.push({ v: id, l: "Owner: " + nameOf(id) }));
    opts.push({ v: "", l: "No owner yet" });
    return opts;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Give the routine a name.");
      return;
    }
    if (!days.length) {
      toast("Pick at least one day.");
      return;
    }
    const ownerId = owner === "me" ? meId : owner || null;
    const followups = steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), afterMin: s.afterMin }));
    setBusy(true);
    const ok = await createRoutine({ name: trimmed, ownerId, days: [...days].sort(), followups });
    setBusy(false);
    if (ok) {
      toast("Routine added.");
      onClose();
    }
  }

  return (
    <Sheet title="New routine" onClose={onClose}>
      <form className="rform" onSubmit={handleSubmit}>
        <input
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="For example: Start a load of laundry"
          aria-label="Routine name"
        />

        <div className="label">Repeats on</div>
        <div className="days" role="group" aria-label="Days">
          {DAY_ORDER.map((d) => (
            <button
              key={d}
              className="dchip"
              type="button"
              aria-pressed={days.includes(d)}
              onClick={() => toggleDay(d)}
            >
              {DAY_SHORT[d]}
            </button>
          ))}
        </div>
        <div className="row">
          <button
            className="linkbtn"
            type="button"
            onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}
          >
            Every day
          </button>
          <button className="linkbtn" type="button" onClick={() => setDays([1, 2, 3, 4, 5])}>
            Weekdays
          </button>
        </div>

        <div className="label">Owner</div>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
          {ownerOptions().map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>

        <div className="label">Follow-up reminders (optional)</div>
        <p className="hint">
          For things with a second step later, like laundry. When you tick the routine, the app
          asks how long until the next step. The times here are only suggestions.
        </p>
        <div className="row">
          <button
            className="linkbtn"
            type="button"
            onClick={() => setSteps(JSON.parse(JSON.stringify(STEP_PRESETS.laundry)))}
          >
            Use laundry
          </button>
          <button
            className="linkbtn"
            type="button"
            onClick={() => setSteps(JSON.parse(JSON.stringify(STEP_PRESETS.dishwasher)))}
          >
            Use dishwasher
          </button>
        </div>

        {steps.map((s, i) => {
          const opts = [...MIN_OPTIONS];
          if (!opts.includes(s.afterMin)) {
            opts.push(s.afterMin);
            opts.sort((a, b) => a - b);
          }
          return (
            <div className="step" key={i}>
              <div className="label">{i === 0 ? "First reminder" : "Then"}</div>
              <input
                maxLength={80}
                value={s.text}
                placeholder="For example: Start the dryer"
                aria-label={`Reminder ${i + 1}`}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((st, idx) => (idx === i ? { ...st, text: e.target.value } : st)),
                  )
                }
              />
              <button
                className="x"
                type="button"
                aria-label="Remove this reminder"
                onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
              >
                &times;
              </button>
              <select
                aria-label="When to remind"
                value={s.afterMin}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((st, idx) =>
                      idx === i ? { ...st, afterMin: Number(e.target.value) } : st,
                    ),
                  )
                }
              >
                {opts.map((m) => (
                  <option key={m} value={m}>
                    Suggest {fmtDur(m)}
                    {i === 0 ? " after I tick this routine" : " after the previous one is done"}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        <div>
          <button
            className="linkbtn"
            type="button"
            onClick={() =>
              setSteps((prev) => [...prev, { text: "", afterMin: prev.length ? 60 : 120 }])
            }
          >
            + Add a reminder
          </button>
        </div>

        <div className="row">
          <button className="btn primary" type="submit" disabled={busy}>
            Add routine
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Sheet>
  );
}
