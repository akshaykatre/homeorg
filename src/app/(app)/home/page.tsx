"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import RemindersCard from "@/components/reminders-card";
import RoutineRow, { type RoutineRowData } from "@/components/routine-row";
import RoutineManageRow from "@/components/routine-manage-row";
import RoutineSheet from "@/components/routine-sheet";
import TimerSheet, { type TimerPromptInit } from "@/components/timer-sheet";

function byCreated<T extends { created_at: string }>(a: T, b: T) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function effOwner(r: { owner_id: string | null }, l: { helper_id: string | null } | null) {
  return (l && l.helper_id) || r.owner_id || null;
}

export default function HomePage() {
  const router = useRouter();
  const { routines, tasks, profiles, meId, isMe, nameOf, partnerName, otherIds, logMap, routineHelp } =
    useAppData();
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false);
  const [timerPrompt, setTimerPrompt] = useState<TimerPromptInit | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const me = profiles.find((p) => p.id === meId);
  const first = (me?.display_name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const now = useNow();
  const lm = logMap();
  const dow = new Date(now).getDay();

  const rows: RoutineRowData[] = useMemo(() => {
    const due = routines.filter((r) => (r.days || []).includes(dow)).slice().sort(byCreated);
    return due.map((r) => {
      const l = lm[r.id] || null;
      return { r, l, o: effOwner(r, l), done: !!(l && l.done) };
    });
  }, [routines, dow, lm]);

  const open = rows.filter((x) => !x.done);
  const doneN = rows.length - open.length;
  const pn = partnerName;
  const hasPartner = otherIds().length > 0;
  const mine = open.filter((x) => isMe(x.o));
  const theirs = open.filter((x) => x.o && !isMe(x.o));
  const handReq = theirs.find((x) => x.l && x.l.needs_hand);

  let msg = "";
  let btn: { label: string; onClick: () => void } | null = null;
  let warm = false;

  if (!routines.length) {
    msg = "Add the things that repeat, like the bins or laundry, and today's list shows up here.";
    btn = { label: "Add a routine", onClick: () => setRoutineSheetOpen(true) };
  } else if (!rows.length) {
    msg = "Nothing is scheduled for today. A quiet day.";
  } else if (!open.length) {
    msg = "Everything due today is done. Nicely handled.";
  } else if (handReq) {
    msg = `${pn} could use a hand with ${handReq.r.name}. If you have the bandwidth, take it.`;
    btn = { label: "I'll help with this", onClick: () => helpWith(handReq.r.id) };
    warm = true;
  } else if (!mine.length && theirs.length) {
    msg = `Your list is clear. ${pn} still has ${theirs.length} to do. If you have the bandwidth, take one off their plate.`;
    btn = { label: `Help with ${theirs[0].r.name}`, onClick: () => helpWith(theirs[0].r.id) };
  } else if (!theirs.length && mine.length && hasPartner) {
    msg = `${pn} has finished their list. ${mine.length} left on yours, and you are nearly there.`;
  } else if (theirs.length - mine.length >= 2) {
    msg = `${pn} has ${theirs.length} left and you have ${mine.length}. If you have room, take one off their plate.`;
    btn = { label: `Help with ${theirs[0].r.name}`, onClick: () => helpWith(theirs[0].r.id) };
  } else if (mine.length - theirs.length >= 2 && hasPartner) {
    msg = `You have ${mine.length} left and ${pn} has ${theirs.length}. If it is a lot today, tap Could use a hand on one and ${pn} will see it.`;
  } else {
    msg = hasPartner
      ? `${open.length} left today, shared fairly evenly. Keep going at your own pace.`
      : `${open.length} left today.`;
  }

  function helpWith(routineId: string) {
    const r = routines.find((x) => x.id === routineId);
    if (r) routineHelp(r);
  }

  const order: (string | "me" | "none")[] = [];
  if (rows.some((x) => isMe(x.o))) order.push("me");
  rows.forEach((x) => {
    if (x.o && !isMe(x.o) && !order.includes(x.o)) order.push(x.o);
  });
  if (rows.some((x) => !x.o)) order.push("none");

  const grab = tasks.filter((t) => !t.done && !t.owner_id).length;

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div className="hello">
          <h2>
            {greet}
            {first ? `, ${first}` : ""}
          </h2>
          {rows.length > 0 && (
            <p className="lede">
              {doneN} of {rows.length} routines done today
            </p>
          )}
        </div>
        <button
          className="btn sm"
          type="button"
          onClick={() => setTimerPrompt({ routine: null, text: "", minutes: 30, rest: [] })}
        >
          + Reminder
        </button>
      </div>

      <RemindersCard onFollowup={setTimerPrompt} />

      <div className={"nudge" + (warm ? " warm" : "")} role="status">
        <p>{msg}</p>
        {btn && (
          <button className="btn primary sm" type="button" onClick={btn.onClick}>
            {btn.label}
          </button>
        )}
      </div>

      {order.map((o) => {
        const g = rows.filter((x) => (o === "me" ? isMe(x.o) : o === "none" ? !x.o : x.o === o));
        g.sort((a, b) => (Number(a.done) - Number(b.done)) || byCreated(a.r, b.r));
        const gd = g.filter((x) => x.done).length;
        const title = o === "me" ? "Yours today" : o === "none" ? "No owner yet" : `${nameOf(o as string)}'s today`;
        return (
          <article className="card" key={o}>
            <div className="card-head">
              <h3>{title}</h3>
              <div className="meta">
                <span>
                  {gd} of {g.length} done
                </span>
              </div>
            </div>
            <ul className="rt">
              {g.map((x) => (
                <RoutineRow x={x} key={x.r.id} onFollowup={setTimerPrompt} />
              ))}
            </ul>
          </article>
        );
      })}

      {grab > 0 && (
        <article className="card">
          <h3>Up for grabs</h3>
          <p className="lede">
            {grab} {grab === 1 ? "task has" : "tasks have"} no owner yet. Pick one up if you have
            a moment.
          </p>
          <div>
            <button
              className="btn sm"
              type="button"
              onClick={() => router.push("/board?filter=grab")}
            >
              See what is up for grabs
            </button>
          </div>
        </article>
      )}

      <article className="card">
        <details open={manageOpen || !routines.length} style={{ borderTop: 0, paddingTop: 0 }}>
          <summary onClick={(e) => { e.preventDefault(); setManageOpen((v) => !v); }}>
            All routines ({routines.length})
          </summary>
          {routines.length > 0 && (
            <ul className="rmanage">
              {routines
                .slice()
                .sort(byCreated)
                .map((r) => (
                  <RoutineManageRow r={r} key={r.id} />
                ))}
            </ul>
          )}
        </details>
        <div style={{ paddingTop: 4 }}>
          <button className="btn sm" type="button" onClick={() => setRoutineSheetOpen(true)}>
            + New routine
          </button>
        </div>
      </article>

      {routineSheetOpen && <RoutineSheet onClose={() => setRoutineSheetOpen(false)} />}
      {timerPrompt && <TimerSheet init={timerPrompt} onClose={() => setTimerPrompt(null)} />}
    </div>
  );
}
