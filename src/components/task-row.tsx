"use client";

import { useAppData } from "@/lib/store";
import type { Project, Task } from "@/lib/types";

function byCreated<T extends { created_at: string }>(a: T, b: T) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function TaskRow({ t, projects }: { t: Task; projects: Project[] }) {
  const { isMe, nameOf, takeTask, releaseTask, toggleTask, deleteTask, placeTask } = useAppData();

  let own: React.ReactNode = null;
  if (!t.done) {
    if (!t.owner_id) {
      own = (
        <button className="take" type="button" onClick={() => takeTask(t)}>
          I&rsquo;ll take it
        </button>
      );
    } else if (isMe(t.owner_id)) {
      own = (
        <button
          className="chip mine"
          type="button"
          title="Tap to put it back up for grabs"
          aria-label="Yours. Tap to put it back up for grabs"
          onClick={() => releaseTask(t)}
        >
          You
        </button>
      );
    } else {
      own = <span className="chip">{nameOf(t.owner_id)}</span>;
    }
  }

  return (
    <li className={t.done ? "done" : ""}>
      <button
        className="check"
        type="button"
        aria-pressed={t.done}
        aria-label={t.done ? "Mark as not done" : "Mark as done"}
        onClick={() => toggleTask(t)}
      />
      <span className="ttext">{t.text}</span>
      {own || <span />}
      <button className="x" type="button" aria-label="Delete task" onClick={() => deleteTask(t)}>
        &times;
      </button>
      {t.unsure && !t.done && (
        <div className="extra">
          <select
            aria-label="Where does this belong?"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              placeTask(t, v === "__loose" ? null : v);
            }}
          >
            <option value="">Not sure where this goes. Choose...</option>
            <option value="__loose">Keep as a loose task</option>
            {projects
              .slice()
              .sort(byCreated)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      )}
    </li>
  );
}
