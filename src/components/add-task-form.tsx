"use client";

import { useState } from "react";
import { useAppData } from "@/lib/store";

export default function AddTaskForm({ projectId }: { projectId: string | null }) {
  const { newTask } = useAppData();
  const [text, setText] = useState("");

  return (
    <form
      className="addrow"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const ok = await newTask(text, projectId);
        if (ok) setText("");
      }}
    >
      <input
        maxLength={200}
        placeholder="Add a task"
        aria-label="Add a task"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn sm" type="submit">
        Add
      </button>
    </form>
  );
}
