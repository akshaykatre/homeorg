"use client";

import { useState } from "react";
import { useAppData } from "@/lib/store";
import { daysLabel, followSummary } from "@/lib/time";
import type { Routine } from "@/lib/types";

export default function RoutineManageRow({ r }: { r: Routine }) {
  const { meId, isMe, nameOf, otherIds, setRoutineOwner, deleteRoutine } = useAppData();
  const [confirming, setConfirming] = useState(false);

  const ownerOptions = [
    { v: "me", l: "Owner: You" },
    ...otherIds().map((id) => ({ v: id, l: "Owner: " + nameOf(id) })),
    { v: "", l: "No owner yet" },
  ];
  const sel = r.owner_id ? (isMe(r.owner_id) ? "me" : r.owner_id) : "";

  function handleOwnerChange(v: string) {
    if (v === "me" && !meId) return;
    setRoutineOwner(r, v === "me" ? meId : v || null);
  }

  return (
    <li>
      <div className="ttext" style={{ padding: 0 }}>
        <b>{r.name}</b>
        <span className="sub">{daysLabel(r.days)}</span>
        {r.followups && r.followups.length > 0 && (
          <span className="sub">Then: {followSummary(r.followups)}</span>
        )}
      </div>
      {confirming ? (
        <span className="confirm">
          Delete this routine?
          <button className="btn sm danger" type="button" onClick={() => deleteRoutine(r)}>
            Delete
          </button>
          <button className="btn sm ghost" type="button" onClick={() => setConfirming(false)}>
            Keep
          </button>
        </span>
      ) : (
        <button className="linkbtn danger" type="button" onClick={() => setConfirming(true)}>
          Delete
        </button>
      )}
      <select
        aria-label={`Owner of ${r.name}`}
        value={sel}
        onChange={(e) => handleOwnerChange(e.target.value)}
      >
        {ownerOptions.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </li>
  );
}
