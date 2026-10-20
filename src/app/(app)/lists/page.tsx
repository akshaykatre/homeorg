"use client";

import { useState } from "react";
import { useAppData } from "@/lib/store";
import ListCard from "@/components/list-card";

function byCreated<T extends { created_at: string }>(a: T, b: T) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function ListsPage() {
  const { lists, createList } = useAppData();
  const [newListText, setNewListText] = useState("");

  const sorted = [...lists].sort(byCreated);

  return (
    <div className="panel">
      {sorted.map((l) => (
        <ListCard list={l} builtin={l.kind === "grocery"} key={l.id} />
      ))}

      <form
        className="addrow"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newListText.trim()) return;
          const ok = await createList(newListText);
          if (ok) setNewListText("");
        }}
      >
        <input
          maxLength={60}
          placeholder="New list, for example Groceries or Packing"
          aria-label="New list name"
          value={newListText}
          onChange={(e) => setNewListText(e.target.value)}
        />
        <button className="btn sm" type="submit">
          Create
        </button>
      </form>
      <p className="hint">Name it like a list you have made before and your usual items show up as chips.</p>
    </div>
  );
}
