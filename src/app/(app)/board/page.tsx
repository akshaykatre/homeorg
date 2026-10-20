"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppData } from "@/lib/store";
import TaskRow from "@/components/task-row";
import AddTaskForm from "@/components/add-task-form";
import type { Project, Task } from "@/lib/types";

function byCreated<T extends { created_at: string }>(a: T, b: T) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

type Filter = "all" | "grab" | "mine" | "theirs";

function BoardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tasks, projects, meId, isMe, nameOf, renameProject, deleteProject, takeLead, createProject } =
    useAppData();

  const initialFilter = (searchParams.get("filter") as Filter) || "all";
  const [filter, setFilter] = useState<Filter>(
    initialFilter === "grab" || initialFilter === "mine" || initialFilter === "theirs"
      ? initialFilter
      : "all",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newProjectText, setNewProjectText] = useState("");

  const counts = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    return {
      grab: open.filter((t) => !t.owner_id).length,
      mine: open.filter((t) => isMe(t.owner_id)).length,
      theirs: open.filter((t) => t.owner_id && !isMe(t.owner_id)).length,
    };
  }, [tasks, isMe]);

  const otherLabel = useMemo(() => {
    const ids: string[] = [];
    tasks.forEach((t) => {
      if (!t.done && t.owner_id && !isMe(t.owner_id) && !ids.includes(t.owner_id)) ids.push(t.owner_id);
    });
    return ids.length === 1 ? `${nameOf(ids[0])}'s` : "Theirs";
  }, [tasks, isMe, nameOf]);

  function match(t: Task) {
    if (filter === "all") return true;
    if (t.done) return false;
    if (filter === "grab") return !t.owner_id;
    if (filter === "mine") return isMe(t.owner_id);
    return !!t.owner_id && !isMe(t.owner_id);
  }

  function chip(key: Filter, label: string, n: number | null) {
    return (
      <button
        className={"fchip" + (key === "grab" ? " grab" : "")}
        type="button"
        aria-pressed={filter === key}
        onClick={() => setFilter(key)}
      >
        {label}
        {n != null && <span className="n"> {n}</span>}
      </button>
    );
  }

  function startRename(p: Project) {
    setEditingId(p.id);
    setRenameText(p.name);
  }

  async function saveRename(p: Project) {
    const name = renameText.trim();
    if (name) await renameProject(p, name);
    setEditingId(null);
  }

  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const projectCards = sortedProjects
    .map((p) => {
      const pTasks = tasks.filter((t) => t.project_id === p.id).sort(byCreated);
      const open = pTasks.filter((t) => !t.done);
      const done = pTasks.filter((t) => t.done);
      const shown = open.filter(match);
      if (filter !== "all" && !shown.length) return null;

      const lead = p.lead_id ? `Lead: ${nameOf(p.lead_id)}` : "No lead yet";

      return (
        <article className="card" key={p.id}>
          <div className="card-head">
            {editingId === p.id ? (
              <form
                className="addrow"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveRename(p);
                }}
              >
                <input
                  maxLength={80}
                  aria-label="Project name"
                  value={renameText}
                  autoFocus
                  onChange={(e) => setRenameText(e.target.value)}
                />
                <button className="btn sm" type="submit">
                  Save
                </button>
              </form>
            ) : (
              <button className="pname" type="button" title="Tap to rename" onClick={() => startRename(p)}>
                {p.name}
              </button>
            )}
            <div className="meta">
              <span>{lead}</span>
              <span>
                {done.length} of {pTasks.length} done
              </span>
              {meId && p.lead_id !== meId && (
                <button className="linkbtn" type="button" onClick={() => takeLead(p)}>
                  Take the lead
                </button>
              )}
              {confirmDeleteId === p.id ? (
                <span className="confirm">
                  Delete this project and its tasks?
                  <button
                    className="btn sm danger"
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(null);
                      deleteProject(p);
                    }}
                  >
                    Delete
                  </button>
                  <button className="btn sm ghost" type="button" onClick={() => setConfirmDeleteId(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  className="linkbtn danger"
                  type="button"
                  onClick={() => setConfirmDeleteId(p.id)}
                >
                  Delete project
                </button>
              )}
            </div>
          </div>
          {shown.length ? (
            <ul className="tasks">
              {shown.map((t) => (
                <TaskRow t={t} projects={projects} key={t.id} />
              ))}
            </ul>
          ) : (
            filter === "all" && <p className="lede">No open tasks.</p>
          )}
          {filter === "all" && (
            <>
              {done.length > 0 && (
                <details>
                  <summary>{done.length} done</summary>
                  <ul className="tasks">
                    {done.map((t) => (
                      <TaskRow t={t} projects={projects} key={t.id} />
                    ))}
                  </ul>
                </details>
              )}
              <AddTaskForm projectId={p.id} />
            </>
          )}
        </article>
      );
    })
    .filter(Boolean);

  const loose = tasks.filter((t) => !t.project_id).sort(byCreated);
  const looseOpen = loose.filter((t) => !t.done);
  const looseDone = loose.filter((t) => t.done);
  const looseShown = looseOpen.filter(match);
  const showLoose = filter === "all" || looseShown.length > 0;

  const isEmpty = !projects.length && !tasks.length;

  let body: React.ReactNode;
  if (isEmpty) {
    body = (
      <article className="card empty">
        <h3>Nothing pending yet</h3>
        <p>
          Dump what is on your mind and it lands here as projects and tasks. Whatever is not
          claimed shows as up for grabs.
        </p>
        <button className="btn primary" type="button" onClick={() => router.push("/dump")}>
          Go to the dump
        </button>
      </article>
    );
  } else {
    body = (
      <>
        {projectCards}
        {showLoose && (
          <article className="card">
            <div className="card-head">
              <h3>Loose tasks</h3>
              <div className="meta">
                <span>One-offs that do not belong to a project</span>
              </div>
            </div>
            {looseShown.length ? (
              <ul className="tasks">
                {looseShown.map((t) => (
                  <TaskRow t={t} projects={projects} key={t.id} />
                ))}
              </ul>
            ) : (
              filter === "all" && <p className="lede">Nothing loose right now.</p>
            )}
            {filter === "all" && (
              <>
                {looseDone.length > 0 && (
                  <details>
                    <summary>{looseDone.length} done</summary>
                    <ul className="tasks">
                      {looseDone.map((t) => (
                        <TaskRow t={t} projects={projects} key={t.id} />
                      ))}
                    </ul>
                  </details>
                )}
                <AddTaskForm projectId={null} />
              </>
            )}
          </article>
        )}
        {filter === "all" && (
          <form
            className="addrow"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newProjectText.trim()) return;
              const ok = await createProject(newProjectText);
              if (ok) setNewProjectText("");
            }}
          >
            <input
              maxLength={80}
              placeholder="New project, for example Birthday party"
              aria-label="New project name"
              value={newProjectText}
              onChange={(e) => setNewProjectText(e.target.value)}
            />
            <button className="btn sm" type="submit">
              Create
            </button>
          </form>
        )}
      </>
    );
  }

  return (
    <>
      <div className="filters" role="group" aria-label="Filter tasks">
        {chip("all", "All", null)}
        {chip("grab", "Up for grabs", counts.grab)}
        {chip("mine", "Mine", counts.mine)}
        {chip("theirs", otherLabel, counts.theirs)}
      </div>
      <div className="panel">{body}</div>
    </>
  );
}

export default function BoardPage() {
  return (
    <Suspense>
      <BoardInner />
    </Suspense>
  );
}
