"use client";

import { useAppData } from "@/lib/store";
import type { Routine, RoutineLog } from "@/lib/types";
import type { TimerPromptInit } from "./timer-sheet";

export type RoutineRowData = {
  r: Routine;
  l: RoutineLog | null;
  o: string | null;
  done: boolean;
};

export default function RoutineRow({
  x,
  onFollowup,
}: {
  x: RoutineRowData;
  onFollowup: (init: TimerPromptInit) => void;
}) {
  const { r, l, o, done } = x;
  const { isMe, nameOf, routineTick, routineHelp, routineUnhelp, routineNeedHand, routineClaim } =
    useAppData();

  const subs: React.ReactNode[] = [];
  if (l && l.helper_id && r.owner_id && l.helper_id !== r.owner_id) {
    if (isMe(l.helper_id)) subs.push(<span className="sub" key="h">You are helping {nameOf(r.owner_id)}</span>);
    else if (isMe(r.owner_id)) subs.push(<span className="sub" key="h">{nameOf(l.helper_id)} is helping you</span>);
    else subs.push(<span className="sub" key="h">Someone is helping out</span>);
  }
  if (done && l && l.done_by && l.done_by !== o) {
    subs.push(<span className="sub" key="d">Done by {nameOf(l.done_by)}</span>);
  }
  if (!done && l && l.needs_hand) {
    subs.push(<span className="sub hand" key="n">Could use a hand</span>);
  }

  async function handleTick() {
    const { ok, justCompleted } = await routineTick(r);
    if (ok && justCompleted) {
      onFollowup({
        routine: { id: r.id, name: r.name },
        text: r.followups[0].text,
        minutes: r.followups[0].afterMin,
        rest: r.followups.slice(1),
      });
    }
  }

  let acts: React.ReactNode = null;
  if (!done) {
    if (isMe(o)) {
      acts =
        l && isMe(l.helper_id) ? (
          <button className="mini" type="button" onClick={() => routineUnhelp(r)}>
            Hand back
          </button>
        ) : (
          <button className="mini" type="button" onClick={() => routineNeedHand(r)}>
            {l && l.needs_hand ? "Hand requested" : "Could use a hand"}
          </button>
        );
    } else if (!o) {
      acts = (
        <button className="mini warm" type="button" onClick={() => routineClaim(r)}>
          I&rsquo;ll own it
        </button>
      );
    } else {
      acts = (
        <button className="mini warm" type="button" onClick={() => routineHelp(r)}>
          I&rsquo;ll help
        </button>
      );
    }
  }

  return (
    <li className={done ? "done" : ""}>
      <button
        className="check"
        type="button"
        aria-pressed={done}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        onClick={handleTick}
      />
      <div className="ttext">
        {r.name}
        {subs}
      </div>
      <div className="racts">{acts}</div>
    </li>
  );
}
