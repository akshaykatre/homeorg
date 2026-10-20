"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { DAY_ORDER, DAY_SHORT, presetFollowups } from "@/lib/time";
import type { FollowupStep } from "@/lib/types";

type ReviewProject = { key: string; name: string; existingId: string | null };
type ReviewItem = { id: number; text: string; dest: string; suggested?: boolean };
type ReviewRoutine = { key: string; name: string; days: number[]; followups: FollowupStep[] };
type ReviewState = {
  raw: string;
  projects: ReviewProject[];
  items: ReviewItem[];
  routines: ReviewRoutine[];
};

function splitLines(text: string) {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function DumpPage() {
  const router = useRouter();
  const toast = useToast();
  const { projects, tasks, dumps, saveDumpReview } = useAppData();

  const [dumpText, setDumpText] = useState("");
  const [review, setReview] = useState<ReviewState | null>(null);
  const [status, setStatusMsg] = useState<{ msg: string; err: boolean }>({ msg: "", err: false });
  const [showFallback, setShowFallback] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);
  const nextId = () => ++seq.current;

  function setStatus(msg: string, err = false) {
    setStatusMsg({ msg, err });
  }

  function fallbackReview(text: string): ReviewState {
    return {
      raw: text,
      projects: [],
      items: splitLines(text).map((s) => ({ id: nextId(), text: s, dest: "loose" })),
      routines: [],
    };
  }

  function toReview(text: string, data: unknown): ReviewState {
    const d = (data || {}) as {
      projects?: { name?: string; existing?: string | null; tasks?: (string | { text?: string; suggested?: boolean })[] }[];
      tasks?: string[];
      groceries?: string[];
      unsure?: string[];
      routines?: { name?: string; days?: number[] }[];
    };
    const arr = (x: unknown): string[] =>
      Array.isArray(x) ? x.map((v) => String(v ?? "").trim()).filter(Boolean) : [];
    const r: ReviewState = { raw: text, projects: [], items: [], routines: [] };
    (Array.isArray(d.projects) ? d.projects : []).forEach((p, i) => {
      const existing = projects.find((e) => e.id === p.existing);
      const key = "proj:" + i;
      r.projects.push({
        key,
        name: existing ? existing.name : String(p.name || "").trim(),
        existingId: existing ? existing.id : null,
      });
      (Array.isArray(p.tasks) ? p.tasks : []).forEach((t) => {
        const isObj = !!t && typeof t === "object";
        const text = String(isObj ? (t as { text?: string }).text || "" : t ?? "").trim();
        if (text) {
          r.items.push({
            id: nextId(),
            text,
            dest: key,
            suggested: isObj && !!(t as { suggested?: boolean }).suggested,
          });
        }
      });
    });
    arr(d.tasks).forEach((t) => r.items.push({ id: nextId(), text: t, dest: "loose" }));
    arr(d.groceries).forEach((t) => r.items.push({ id: nextId(), text: t, dest: "groceries" }));
    arr(d.unsure).forEach((t) => r.items.push({ id: nextId(), text: t, dest: "unsure" }));
    (Array.isArray(d.routines) ? d.routines : []).forEach((ro, i) => {
      const name = String(ro.name || "").trim();
      const days = Array.isArray(ro.days)
        ? [...new Set(ro.days.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6))]
        : [];
      if (name) r.routines.push({ key: "rt:" + i, name, days, followups: presetFollowups(name) });
    });
    return r;
  }

  async function startSort() {
    const text = dumpText.trim();
    if (!text) {
      setStatus("Write something first.");
      return;
    }
    setShowFallback(false);
    setSorting(true);
    setReview(null);
    setStatus("Sorting...");
    try {
      const existing = projects.map((p) => ({
        id: p.id,
        name: p.name,
        tasks: tasks.filter((t) => t.project_id === p.id).map((t) => t.text),
      }));
      const res = await fetch("/api/sort", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, existing }),
      });

      if (res.status === 503) {
        setReview(fallbackReview(text));
        setStatus("Sorting is not available here. Each line is a loose task you can move around.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        const code = body?.error;
        const msg =
          code === "rate_limited"
            ? "Too many requests right now. Try again in a minute."
            : code === "invalid_json"
              ? "The sorting came back garbled. Try again."
              : "Sorting did not work this time.";
        setStatus(`${msg} You can also add each line as a task.`, true);
        setShowFallback(true);
        return;
      }

      const { data } = await res.json();
      const r = toReview(text, data);
      if (!r.items.length && !r.projects.length && !r.routines.length) {
        setStatus("Nothing to sort in that. Try adding a bit more.", true);
        return;
      }
      setReview(r);
      const ns = r.items.filter((i) => i.suggested).length;
      setStatus(
        ns
          ? `Check how it was sorted. ${ns} steps are suggestions. Keep the ones that help and delete the rest.`
          : "Check how it was sorted, change anything, then save.",
      );
    } finally {
      setSorting(false);
    }
  }

  function useFallback() {
    const text = dumpText.trim();
    if (!text) return;
    setReview(fallbackReview(text));
    setShowFallback(false);
    setStatus("Each line is a loose task. Move them around before saving.");
  }

  function updateItemText(id: number, text: string) {
    setReview((r) => (r ? { ...r, items: r.items.map((i) => (i.id === id ? { ...i, text } : i)) } : r));
  }

  function updateItemDest(id: number, dest: string) {
    setReview((r) => (r ? { ...r, items: r.items.map((i) => (i.id === id ? { ...i, dest } : i)) } : r));
  }

  function deleteItem(id: number) {
    setReview((r) => (r ? { ...r, items: r.items.filter((i) => i.id !== id) } : r));
  }

  function addItemToGroup(key: string) {
    const id = nextId();
    setReview((r) => (r ? { ...r, items: [...r.items, { id, text: "", dest: key }] } : r));
  }

  function updateProjectName(key: string, name: string) {
    setReview((r) =>
      r ? { ...r, projects: r.projects.map((p) => (p.key === key ? { ...p, name } : p)) } : r,
    );
  }

  function removeProjectGroup(key: string) {
    setReview((r) =>
      r
        ? {
            ...r,
            items: r.items.map((i) => (i.dest === key ? { ...i, dest: "loose" } : i)),
            projects: r.projects.filter((p) => p.key !== key),
          }
        : r,
    );
  }

  function updateRoutineName(key: string, name: string) {
    setReview((r) =>
      r ? { ...r, routines: r.routines.map((ro) => (ro.key === key ? { ...ro, name } : ro)) } : r,
    );
  }

  function toggleRoutineDay(key: string, day: number) {
    setReview((r) =>
      r
        ? {
            ...r,
            routines: r.routines.map((ro) =>
              ro.key === key
                ? {
                    ...ro,
                    days: ro.days.includes(day)
                      ? ro.days.filter((d) => d !== day)
                      : [...ro.days, day],
                  }
                : ro,
            ),
          }
        : r,
    );
  }

  function removeRoutine(key: string) {
    setReview((r) => (r ? { ...r, routines: r.routines.filter((ro) => ro.key !== key) } : r));
  }

  function addRoutine() {
    const key = "rt:new:" + nextId();
    setReview((r) =>
      r
        ? { ...r, routines: [...r.routines, { key, name: "", days: [1, 2, 3, 4, 5], followups: [] }] }
        : r,
    );
  }

  function discardReview() {
    setReview(null);
    setStatus("");
    setShowFallback(false);
  }

  async function handleSaveReview() {
    if (!review) return;
    const items = review.items.filter((i) => i.text.trim());
    const routines = review.routines.filter((ro) => ro.name.trim() && ro.days.length);
    if (!items.length && !review.projects.length && !routines.length) {
      setStatus("Nothing to save.", true);
      return;
    }
    setSaving(true);
    try {
      const result = await saveDumpReview(
        review.raw,
        review.projects,
        items.map((i) => ({ text: i.text, dest: i.dest })),
        routines.map((ro) => ({ name: ro.name, days: ro.days, followups: ro.followups })),
      );
      if (!result) return;
      setReview(null);
      setDumpText("");
      setStatus("");
      const bits: string[] = [];
      if (result.projects) bits.push(`${result.projects} ${result.projects === 1 ? "project" : "projects"}`);
      if (result.tasks) bits.push(`${result.tasks} ${result.tasks === 1 ? "task" : "tasks"}`);
      if (result.groceries) bits.push(`${result.groceries} for groceries`);
      if (result.routines) bits.push(`${result.routines} ${result.routines === 1 ? "routine" : "routines"}`);
      toast("Saved: " + bits.join(", "));
      router.push("/board");
    } finally {
      setSaving(false);
    }
  }

  const dests = review
    ? review.projects
        .map((p) => ({ v: p.key, l: p.name || "Untitled project" }))
        .concat([
          { v: "loose", l: "Loose task" },
          { v: "groceries", l: "Groceries" },
          { v: "unsure", l: "Not sure yet" },
        ])
    : [];

  function renderGroup(title: React.ReactNode, key: string) {
    if (!review) return null;
    const its = review.items.filter((i) => i.dest === key);
    return (
      <section className="rgroup" key={key}>
        {title}
        {its.length ? (
          <ul>
            {its.map((it) => (
              <li className="rrow" key={it.id}>
                {it.suggested && (
                  <span className="badge" style={{ gridColumn: "1/-1", justifySelf: "start" }}>
                    Suggested
                  </span>
                )}
                <input
                  maxLength={200}
                  aria-label="Item text"
                  value={it.text}
                  onChange={(e) => updateItemText(it.id, e.target.value)}
                />
                <button
                  className="x"
                  type="button"
                  aria-label="Remove item"
                  onClick={() => deleteItem(it.id)}
                >
                  &times;
                </button>
                <select
                  aria-label="Move to"
                  value={it.dest}
                  onChange={(e) => updateItemDest(it.id, e.target.value)}
                >
                  {dests.map((d) => (
                    <option key={d.v} value={d.v}>
                      Goes to: {d.l}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lede">Nothing here yet.</p>
        )}
        <button className="linkbtn" type="button" onClick={() => addItemToGroup(key)}>
          + Add an item
        </button>
      </section>
    );
  }

  const unsureCount = review ? review.items.filter((i) => i.dest === "unsure").length : 0;
  const totalItems = review ? review.items.filter((i) => i.text.trim()).length : 0;
  const routineCount = review ? review.routines.length : 0;

  return (
    <div className="panel">
      <div>
        <h2>What&rsquo;s on your mind?</h2>
        <p className="lede">
          Write it the way it comes. Nothing is saved until you have checked how it was sorted.
        </p>
      </div>
      <textarea
        placeholder="Chase the installer about the heat pump, plan the birthday party, bins on Thursday, we're low on diapers..."
        aria-label="Everything on your mind"
        value={dumpText}
        onChange={(e) => setDumpText(e.target.value)}
      />
      <div className="row">
        <button className="btn primary" type="button" disabled={sorting} onClick={startSort}>
          Sort it
        </button>
        <span className={"status" + (status.err ? " err" : "")} role="status" aria-live="polite">
          {status.msg}
          {showFallback && (
            <>
              {" "}
              <button className="linkbtn" type="button" onClick={useFallback}>
                Add each line as a task
              </button>
            </>
          )}
        </span>
      </div>

      {review && (
        <div className="panel">
          {review.projects.map((p) =>
            renderGroup(
              <div className="rhead" key={"head-" + p.key}>
                <input
                  maxLength={80}
                  aria-label="Project name"
                  value={p.name}
                  onChange={(e) => updateProjectName(p.key, e.target.value)}
                />
                <span className="badge">{p.existingId ? "Existing project" : "New project"}</span>
                <button
                  className="x"
                  type="button"
                  aria-label="Remove this project"
                  onClick={() => removeProjectGroup(p.key)}
                >
                  &times;
                </button>
              </div>,
              p.key,
            ),
          )}
          {renderGroup(<h3>Loose tasks</h3>, "loose")}
          {renderGroup(<h3>Groceries</h3>, "groceries")}
          {unsureCount > 0 && renderGroup(<h3>Not sure where this goes</h3>, "unsure")}

          {routineCount > 0 && (
            <section className="rgroup">
              <h3>Routines</h3>
              {review.routines.map((ro) => (
                <div className="rhead" key={ro.key} style={{ flexWrap: "wrap" }}>
                  <input
                    maxLength={80}
                    aria-label="Routine name"
                    value={ro.name}
                    onChange={(e) => updateRoutineName(ro.key, e.target.value)}
                  />
                  <button
                    className="x"
                    type="button"
                    aria-label="Remove this routine"
                    onClick={() => removeRoutine(ro.key)}
                  >
                    &times;
                  </button>
                  <div className="days" style={{ flexBasis: "100%" }} role="group" aria-label="Repeats on">
                    {DAY_ORDER.map((d) => (
                      <button
                        key={d}
                        className="dchip"
                        type="button"
                        aria-pressed={ro.days.includes(d)}
                        onClick={() => toggleRoutineDay(ro.key, d)}
                      >
                        {DAY_SHORT[d]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button className="linkbtn" type="button" onClick={addRoutine}>
                + Add a routine
              </button>
            </section>
          )}
          {routineCount === 0 && (
            <button className="linkbtn" type="button" onClick={addRoutine}>
              + Add a routine
            </button>
          )}

          <div className="row">
            <button className="btn primary" type="button" disabled={saving} onClick={handleSaveReview}>
              Save to home
            </button>
            <button className="btn ghost" type="button" onClick={discardReview}>
              Discard
            </button>
            <span className="rsum">
              {totalItems} {totalItems === 1 ? "item" : "items"}
              {routineCount ? `, ${routineCount} ${routineCount === 1 ? "routine" : "routines"}` : ""}. Tasks
              start up for grabs. You lead new projects.
            </span>
          </div>
        </div>
      )}

      {dumps.length > 0 && (
        <div className="past">
          <h3>Earlier dumps</h3>
          {[...dumps]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((d) => {
              const when = d.created_at
                ? new Date(d.created_at).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              const first = (d.text || "").split("\n")[0].slice(0, 70);
              return (
                <details key={d.id}>
                  <summary>
                    <span className="when">{when}</span>
                    {first}
                  </summary>
                  <p>{d.text}</p>
                </details>
              );
            })}
        </div>
      )}
    </div>
  );
}
