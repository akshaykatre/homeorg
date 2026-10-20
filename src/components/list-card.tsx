"use client";

import { useState } from "react";
import { useAppData } from "@/lib/store";
import type { CatalogItem, List, ListItem } from "@/lib/types";

function byCreated<T extends { created_at: string }>(a: T, b: T) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function slug(t: string) {
  return (
    String(t)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

const STARTERS: Record<string, string[]> = {
  grocery: [
    "Milk",
    "Bread",
    "Eggs",
    "Butter",
    "Cheese",
    "Bananas",
    "Apples",
    "Tomatoes",
    "Onions",
    "Potatoes",
    "Pasta",
    "Rice",
    "Chicken",
    "Coffee",
    "Toilet paper",
    "Dish soap",
    "Diapers",
  ],
  packing: [
    "Diapers",
    "Wipes",
    "Spare clothes",
    "Pyjamas",
    "Favourite blanket",
    "Soft toy",
    "Bottle or cup",
    "Snacks",
    "Sunscreen",
    "Toothbrush",
    "First-aid basics",
    "Phone charger",
  ],
};

function chipsFor(kind: string, catalog: CatalogItem[], onSet: Record<string, 1 | undefined>) {
  const docs = catalog.filter((c) => c.kind === kind);
  const seen: Record<string, 1> = {};
  docs.forEach((c) => {
    seen[slug(c.text)] = 1;
  });
  let out: { kind: string; text: string; uses: number }[] = docs.filter((c) => !c.gone);
  if (out.length < 8) {
    (STARTERS[kind] || []).forEach((t) => {
      if (!seen[slug(t)]) out.push({ kind, text: t, uses: 0 });
    });
  }
  out = out.filter((c) => !onSet[slug(c.text)]);
  out.sort((a, b) => (b.uses || 0) - (a.uses || 0) || (a.text < b.text ? -1 : 1));
  return out;
}

function ListItemRow({ item }: { item: ListItem }) {
  const { toggleListItem, deleteListItem } = useAppData();
  return (
    <li className={item.done ? "done" : ""}>
      <button
        className="check"
        type="button"
        aria-pressed={item.done}
        aria-label={item.done ? "Put back on the list" : "Tick off"}
        onClick={() => toggleListItem(item)}
      />
      <span className="ttext">{item.text}</span>
      <span />
      <button
        className="x"
        type="button"
        aria-label="Take off this list. It stays in your usual items."
        onClick={() => deleteListItem(item)}
      >
        &times;
      </button>
    </li>
  );
}

export default function ListCard({ list, builtin }: { list: List; builtin: boolean }) {
  const { listItems, catalog, addToList, deleteList, clearTicked, hideCatalogItem } = useAppData();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemText, setItemText] = useState("");

  const kind = list.kind;
  const its = listItems.filter((i) => i.list_id === list.id).sort(byCreated);
  const open = its.filter((i) => !i.done);
  const done = its.filter((i) => i.done);
  const onSet: Record<string, 1 | undefined> = {};
  its.forEach((i) => {
    onSet[slug(i.text)] = 1;
  });
  const chips = chipsFor(kind, catalog, onSet);

  return (
    <article className="card">
      <div className="card-head">
        <h3>{list.name}</h3>
        <div className="meta">
          <span>{open.length} to get</span>
          {done.length > 0 && (
            <button className="linkbtn" type="button" onClick={() => clearTicked(list)}>
              Clear {done.length} ticked
            </button>
          )}
          <button className="linkbtn" type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done editing" : "Edit usual items"}
          </button>
          {!builtin &&
            (confirmDelete ? (
              <span className="confirm">
                Delete this list? Your usual items are kept.
                <button
                  className="btn sm danger"
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    deleteList(list);
                  }}
                >
                  Delete
                </button>
                <button className="btn sm ghost" type="button" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button className="linkbtn danger" type="button" onClick={() => setConfirmDelete(true)}>
                Delete list
              </button>
            ))}
        </div>
      </div>

      {its.length ? (
        <ul className="tasks">
          {open.concat(done).map((i) => (
            <ListItemRow item={i} key={i.id} />
          ))}
        </ul>
      ) : (
        <p className="lede">Nothing on the list yet. Tap an item below or type one.</p>
      )}

      <form
        className="addrow"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!itemText.trim()) return;
          const ok = await addToList(list, itemText);
          if (ok) setItemText("");
        }}
      >
        <input
          maxLength={120}
          placeholder="Add an item"
          aria-label={`Add an item to ${list.name}`}
          value={itemText}
          onChange={(e) => setItemText(e.target.value)}
        />
        <button className="btn sm" type="submit">
          Add
        </button>
      </form>

      <div className="label">Usual items</div>
      {chips.length ? (
        <>
          <div className="uchips">
            {chips.map((c) =>
              editing ? (
                <button
                  className="uchip del"
                  type="button"
                  key={c.text}
                  aria-label={`Remove ${c.text} from usual items for good`}
                  onClick={() => hideCatalogItem(kind, c.text)}
                >
                  &times; {c.text}
                </button>
              ) : (
                <button
                  className="uchip"
                  type="button"
                  key={c.text}
                  onClick={() => addToList(list, c.text)}
                >
                  + {c.text}
                </button>
              ),
            )}
          </div>
          {editing && <p className="hint">Tap an item to remove it for good. Anything you type later comes back.</p>}
        </>
      ) : (
        <p className="hint">
          {its.length
            ? "Everything you usually add is already on the list."
            : "Items you add here are remembered for next time."}
        </p>
      )}
    </article>
  );
}
