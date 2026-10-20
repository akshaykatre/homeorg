"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast";
import { fmtDur } from "@/lib/time";
import type {
  ActivityItem,
  CatalogItem,
  Dump,
  FollowupStep,
  List,
  ListItem,
  Profile,
  Project,
  Routine,
  RoutineLog,
  Task,
  Timer,
} from "@/lib/types";

type DataState = {
  profiles: Profile[];
  projects: Project[];
  tasks: Task[];
  lists: List[];
  listItems: ListItem[];
  catalog: CatalogItem[];
  dumps: Dump[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  activity: ActivityItem[];
  timers: Timer[];
};

const EMPTY: DataState = {
  profiles: [],
  projects: [],
  tasks: [],
  lists: [],
  listItems: [],
  catalog: [],
  dumps: [],
  routines: [],
  routineLogs: [],
  activity: [],
  timers: [],
};

// db table name -> state key
const TABLE_KEYS: Record<string, keyof DataState> = {
  profiles: "profiles",
  projects: "projects",
  tasks: "tasks",
  lists: "lists",
  listitems: "listItems",
  catalog: "catalog",
  dumps: "dumps",
  routines: "routines",
  routinelog: "routineLogs",
  activity: "activity",
  timers: "timers",
};

function todayStr() {
  const d = new Date();
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type AppDataContextValue = DataState & {
  meId: string;
  isMe: (id: string | null | undefined) => boolean;
  nameOf: (id: string | null | undefined) => string;
  partner: Profile | null;
  partnerName: string;
  otherIds: () => string[];
  today: string;
  logMap: () => Record<string, RoutineLog>;
  markActivitySeen: () => void;

  // tasks
  newTask: (
    text: string,
    projectId: string | null,
    extra?: Partial<Pick<Task, "unsure">>,
  ) => Promise<boolean>;
  takeTask: (task: Task) => Promise<boolean>;
  releaseTask: (task: Task) => Promise<boolean>;
  toggleTask: (task: Task) => Promise<boolean>;
  deleteTask: (task: Task) => Promise<boolean>;
  placeTask: (task: Task, projectId: string | null) => Promise<boolean>;

  // projects
  createProject: (name: string) => Promise<boolean>;
  renameProject: (project: Project, name: string) => Promise<boolean>;
  deleteProject: (project: Project) => Promise<boolean>;
  takeLead: (project: Project) => Promise<boolean>;

  // routines
  createRoutine: (input: {
    name: string;
    ownerId: string | null;
    days: number[];
    followups: FollowupStep[];
  }) => Promise<boolean>;
  deleteRoutine: (routine: Routine) => Promise<boolean>;
  setRoutineOwner: (routine: Routine, ownerId: string | null) => Promise<boolean>;
  routineTick: (routine: Routine) => Promise<{ ok: boolean; justCompleted: boolean }>;
  routineHelp: (routine: Routine) => Promise<boolean>;
  routineUnhelp: (routine: Routine) => Promise<boolean>;
  routineNeedHand: (routine: Routine) => Promise<boolean>;
  routineClaim: (routine: Routine) => Promise<boolean>;

  // timers
  createTimer: (
    routine: { id: string; name: string } | null,
    step: FollowupStep,
    rest: FollowupStep[],
  ) => Promise<boolean>;
  timerDone: (timer: Timer) => Promise<boolean>;
  timerSnooze: (timer: Timer) => Promise<boolean>;
  timerCancel: (timer: Timer) => Promise<boolean>;

  // lists / catalog
  createList: (name: string) => Promise<boolean>;
  deleteList: (list: List) => Promise<boolean>;
  addToList: (list: List, text: string) => Promise<boolean>;
  toggleListItem: (item: ListItem) => Promise<boolean>;
  deleteListItem: (item: ListItem) => Promise<boolean>;
  clearTicked: (list: List) => Promise<boolean>;
  hideCatalogItem: (kind: string, text: string) => Promise<boolean>;

  // dumps
  saveDump: (text: string) => Promise<string | null>;
  saveDumpReview: (
    raw: string,
    reviewProjects: { key: string; name: string; existingId: string | null }[],
    items: { text: string; dest: string }[],
    reviewRoutines: { name: string; days: number[]; followups: FollowupStep[] }[],
  ) => Promise<{ projects: number; tasks: number; groceries: number; routines: number } | null>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
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

export function AppDataProvider({
  householdId,
  meId,
  children,
}: {
  householdId: string;
  meId: string;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [state, setState] = useState<DataState>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const tables = Object.keys(TABLE_KEYS);
      const results = await Promise.all(
        tables.map((t) => supabase.from(t).select("*").eq("household_id", householdId)),
      );
      if (cancelled) return;
      const next: DataState = { ...EMPTY };
      tables.forEach((t, i) => {
        const key = TABLE_KEYS[t];
        const { data, error } = results[i];
        if (error) {
          console.error(`[store] load ${t} failed`, error);
          return;
        }
        (next[key] as unknown[]) = data ?? [];
      });
      setState(next);
    }
    loadAll();

    let channel = supabase.channel("household:" + householdId);
    Object.keys(TABLE_KEYS).forEach((table) => {
      channel = channel.on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table,
          filter: `household_id=eq.${householdId}`,
        } as never,
        (payload: {
          eventType: "INSERT" | "UPDATE" | "DELETE";
          new: Record<string, unknown> | null;
          old: Record<string, unknown> | null;
        }) => {
          const key = TABLE_KEYS[table];
          const row = (payload.new ?? payload.old) as { id: string } | null;
          if (!row) return;
          setState((prev) => {
            const list = prev[key] as { id: string }[];
            if (payload.eventType === "DELETE") {
              return { ...prev, [key]: list.filter((r) => r.id !== row.id) };
            }
            const idx = list.findIndex((r) => r.id === row.id);
            const nextList =
              idx >= 0
                ? list.map((r, i) => (i === idx ? row : r))
                : [...list, row];
            return { ...prev, [key]: nextList };
          });
        },
      );
    });
    channel.subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, householdId]);

  const isMe = useCallback((id: string | null | undefined) => !!id && id === meId, [meId]);

  const partner = useMemo(
    () => state.profiles.find((p) => p.id !== meId) ?? null,
    [state.profiles, meId],
  );

  const nameOf = useCallback(
    (id: string | null | undefined) => {
      if (!id) return "Partner";
      if (isMe(id)) return "You";
      const p = state.profiles.find((pr) => pr.id === id);
      return (p?.display_name || "").split(" ")[0] || "Partner";
    },
    [isMe, state.profiles],
  );

  const partnerName = (partner?.display_name || "").split(" ")[0] || "Partner";

  const otherIds = useCallback(() => {
    const ids: string[] = [];
    const add = (id: string | null | undefined) => {
      if (id && id !== meId && !ids.includes(id)) ids.push(id);
    };
    state.profiles.forEach((p) => add(p.id));
    state.routines.forEach((r) => add(r.owner_id));
    state.tasks.forEach((t) => add(t.owner_id));
    state.projects.forEach((p) => add(p.lead_id));
    return ids;
  }, [state, meId]);

  const today = todayStr();

  const logMap = useCallback(() => {
    const m: Record<string, RoutineLog> = {};
    state.routineLogs.forEach((l) => {
      if (l.date === today) m[l.routine_id] = l;
    });
    return m;
  }, [state.routineLogs, today]);

  async function run(fn: () => PromiseLike<unknown>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (e) {
      console.error(e);
      toast("That did not save. Try again.");
      return false;
    }
  }

  function logActivity(type: string, subject?: string, extra?: string) {
    return supabase.from("activity").insert({
      household_id: householdId,
      type,
      by: meId,
      subject: subject || "",
      extra: extra || null,
    });
  }

  const markActivitySeen = useCallback(() => {
    supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", meId)
      .then(() => {});
  }, [supabase, meId]);

  // ---------- tasks ----------
  const newTask: AppDataContextValue["newTask"] = async (text, projectId, extra) => {
    text = text.trim();
    if (!text) return false;
    return run(() =>
      supabase.from("tasks").insert({
        household_id: householdId,
        text,
        project_id: projectId || null,
        owner_id: null,
        done: false,
        unsure: !!extra?.unsure,
      }).throwOnError(),
    );
  };

  const takeTask: AppDataContextValue["takeTask"] = (task) =>
    run(async () => {
      await supabase.from("tasks").update({ owner_id: meId }).eq("id", task.id).throwOnError();
      await logActivity("took", task.text);
    });

  const releaseTask: AppDataContextValue["releaseTask"] = (task) =>
    run(() => supabase.from("tasks").update({ owner_id: null }).eq("id", task.id).throwOnError());

  const toggleTask: AppDataContextValue["toggleTask"] = (task) =>
    run(async () => {
      const done = !task.done;
      await supabase
        .from("tasks")
        .update({
          done,
          done_by: done ? meId : null,
          done_at: done ? new Date().toISOString() : null,
        })
        .eq("id", task.id)
        .throwOnError();
      if (done) await logActivity("done", task.text);
    });

  const deleteTask: AppDataContextValue["deleteTask"] = (task) =>
    run(() => supabase.from("tasks").delete().eq("id", task.id).throwOnError());

  const placeTask: AppDataContextValue["placeTask"] = (task, projectId) =>
    run(() =>
      supabase
        .from("tasks")
        .update(projectId ? { project_id: projectId, unsure: false } : { unsure: false })
        .eq("id", task.id)
        .throwOnError(),
    );

  // ---------- projects ----------
  const createProject: AppDataContextValue["createProject"] = (name) => {
    name = name.trim();
    if (!name) return Promise.resolve(false);
    return run(() =>
      supabase.from("projects").insert({ household_id: householdId, name, lead_id: meId }).throwOnError(),
    );
  };

  const renameProject: AppDataContextValue["renameProject"] = (project, name) => {
    name = name.trim();
    if (!name) return Promise.resolve(false);
    return run(() => supabase.from("projects").update({ name }).eq("id", project.id).throwOnError());
  };

  const deleteProject: AppDataContextValue["deleteProject"] = (project) =>
    run(async () => {
      await supabase.from("tasks").delete().eq("project_id", project.id).throwOnError();
      await supabase.from("projects").delete().eq("id", project.id).throwOnError();
    });

  const takeLead: AppDataContextValue["takeLead"] = (project) =>
    run(async () => {
      await supabase.from("projects").update({ lead_id: meId }).eq("id", project.id).throwOnError();
      await logActivity("lead", project.name);
    });

  // ---------- routines ----------
  const createRoutine: AppDataContextValue["createRoutine"] = ({ name, ownerId, days, followups }) => {
    name = name.trim();
    if (!name || !days.length) return Promise.resolve(false);
    return run(() =>
      supabase
        .from("routines")
        .insert({ household_id: householdId, name, owner_id: ownerId, days, followups })
        .throwOnError(),
    );
  };

  const deleteRoutine: AppDataContextValue["deleteRoutine"] = (routine) =>
    run(() => supabase.from("routines").delete().eq("id", routine.id).throwOnError());

  const setRoutineOwner: AppDataContextValue["setRoutineOwner"] = (routine, ownerId) =>
    run(() => supabase.from("routines").update({ owner_id: ownerId }).eq("id", routine.id).throwOnError());

  function saveLog(routine: Routine, patch: Partial<RoutineLog>) {
    const existing = logMap()[routine.id];
    const base = {
      id: routine.id + "_" + today,
      household_id: householdId,
      routine_id: routine.id,
      date: today,
      done: existing?.done ?? false,
      done_by: existing?.done_by ?? null,
      helper_id: existing?.helper_id ?? null,
      needs_hand: existing?.needs_hand ?? false,
      ...patch,
    };
    return supabase.from("routinelog").upsert(base).throwOnError();
  }

  const routineTick: AppDataContextValue["routineTick"] = async (routine) => {
    const l = logMap()[routine.id];
    const done = !(l && l.done);
    const hasFollowups =
      done &&
      routine.followups &&
      routine.followups.length > 0 &&
      !state.timers.some((t) => t.routine_id === routine.id);
    const ok = await run(async () => {
      await saveLog(routine, { done, done_by: done ? meId : null });
      if (done) await logActivity("done", routine.name);
    });
    return { ok, justCompleted: ok && !!hasFollowups };
  };

  const routineHelp: AppDataContextValue["routineHelp"] = (routine) =>
    run(async () => {
      await saveLog(routine, { helper_id: meId, needs_hand: false });
      await logActivity("help", routine.name);
    });

  const routineUnhelp: AppDataContextValue["routineUnhelp"] = (routine) =>
    run(() => saveLog(routine, { helper_id: null }));

  const routineNeedHand: AppDataContextValue["routineNeedHand"] = (routine) =>
    run(async () => {
      const l = logMap()[routine.id];
      const on = !(l && l.needs_hand);
      await saveLog(routine, { needs_hand: on });
      if (on) await logActivity("hand", routine.name);
    });

  const routineClaim: AppDataContextValue["routineClaim"] = (routine) =>
    run(async () => {
      await supabase.from("routines").update({ owner_id: meId }).eq("id", routine.id).throwOnError();
      await logActivity("claim", routine.name);
    });

  // ---------- timers ----------
  const createTimer: AppDataContextValue["createTimer"] = (routine, step, rest) =>
    run(async () => {
      await supabase
        .from("timers")
        .insert({
          household_id: householdId,
          routine_id: routine?.id || null,
          routine_name: routine?.name || null,
          text: step.text,
          due_at: new Date(Date.now() + step.afterMin * 60000).toISOString(),
          rest: rest || [],
          created_by: meId,
        })
        .throwOnError();
      await logActivity("timerset", step.text, fmtDur(step.afterMin));
    });

  const timerDone: AppDataContextValue["timerDone"] = (timer) =>
    run(async () => {
      await supabase.from("timers").delete().eq("id", timer.id).throwOnError();
      await logActivity("timerdone", timer.text || "");
    });

  const timerSnooze: AppDataContextValue["timerSnooze"] = (timer) =>
    run(() =>
      supabase
        .from("timers")
        .update({ due_at: new Date(Date.now() + 15 * 60000).toISOString() })
        .eq("id", timer.id)
        .throwOnError(),
    );

  const timerCancel: AppDataContextValue["timerCancel"] = (timer) =>
    run(() => supabase.from("timers").delete().eq("id", timer.id).throwOnError());

  // ---------- lists / catalog ----------
  function kindOf(list: List) {
    return list.kind;
  }

  const createList: AppDataContextValue["createList"] = (name) => {
    name = name.trim();
    if (!name) return Promise.resolve(false);
    const known: Record<string, 1> = { grocery: 1, packing: 1 };
    state.lists.forEach((l) => {
      if (l.kind) known[l.kind] = 1;
    });
    state.catalog.forEach((c) => {
      if (c.kind) known[c.kind] = 1;
    });
    const STOP: Record<string, 1> = { list: 1, lists: 1, the: 1, my: 1, our: 1, a: 1, for: 1, to: 1, and: 1 };
    function stem(w: string) {
      w = w.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
      if (w.length > 3 && /s$/.test(w)) return w.slice(0, -1);
      return w;
    }
    function toks(s: string) {
      return s.split(/\s+/).map(stem).filter((t) => t && !STOP[t]);
    }
    const head = toks(name.split(/[:–-]/)[0]);
    const all = toks(name);
    let kind = "";
    for (const t of head) if (known[t]) { kind = t; break; }
    if (!kind) for (const t of all) if (known[t]) { kind = t; break; }
    if (!kind) kind = slug(head.join(" ")) || "list";
    return run(() => supabase.from("lists").insert({ household_id: householdId, name, kind }).throwOnError());
  };

  const deleteList: AppDataContextValue["deleteList"] = (list) =>
    run(async () => {
      await supabase.from("listitems").delete().eq("list_id", list.id).throwOnError();
      await supabase.from("lists").delete().eq("id", list.id).throwOnError();
    });

  const addToList: AppDataContextValue["addToList"] = (list, text) => {
    text = text.trim();
    if (!text) return Promise.resolve(false);
    return run(async () => {
      const kind = kindOf(list);
      const cid = kind + "__" + slug(text);
      const existing = state.catalog.find((c) => c.id === cid);
      const already = state.listItems.some(
        (i) => i.list_id === list.id && slug(i.text) === slug(text),
      );
      if (!already) {
        await supabase
          .from("listitems")
          .insert({ household_id: householdId, list_id: list.id, text, done: false })
          .throwOnError();
      }
      await supabase
        .from("catalog")
        .upsert({
          id: cid,
          household_id: householdId,
          kind,
          text: (existing && !existing.gone && existing.text) || text,
          uses: ((existing && !existing.gone ? existing.uses : 0) || 0) + 1,
          gone: false,
        })
        .throwOnError();
    });
  };

  const toggleListItem: AppDataContextValue["toggleListItem"] = (item) =>
    run(() => supabase.from("listitems").update({ done: !item.done }).eq("id", item.id).throwOnError());

  const deleteListItem: AppDataContextValue["deleteListItem"] = (item) =>
    run(() => supabase.from("listitems").delete().eq("id", item.id).throwOnError());

  const clearTicked: AppDataContextValue["clearTicked"] = (list) =>
    run(() =>
      supabase
        .from("listitems")
        .delete()
        .eq("list_id", list.id)
        .eq("done", true)
        .throwOnError(),
    );

  const hideCatalogItem: AppDataContextValue["hideCatalogItem"] = (kind, text) =>
    run(() =>
      supabase
        .from("catalog")
        .upsert({
          id: kind + "__" + slug(text),
          household_id: householdId,
          kind,
          text,
          uses: 0,
          gone: true,
        })
        .throwOnError(),
    );

  // ---------- dumps ----------
  const saveDump: AppDataContextValue["saveDump"] = async (text) => {
    text = text.trim();
    if (!text) return null;
    const { data, error } = await supabase
      .from("dumps")
      .insert({ household_id: householdId, text, by: meId })
      .select()
      .single();
    if (error) {
      console.error(error);
      toast("That did not save. Try again.");
      return null;
    }
    return data.id as string;
  };

  const saveDumpReview: AppDataContextValue["saveDumpReview"] = async (
    raw,
    reviewProjects,
    items,
    reviewRoutines,
  ) => {
    try {
      const { error: dumpErr } = await supabase
        .from("dumps")
        .insert({ household_id: householdId, text: raw, by: meId });
      if (dumpErr) throw dumpErr;

      const pid: Record<string, string> = {};
      let pCount = 0;
      for (const p of reviewProjects) {
        if (p.existingId) {
          pid[p.key] = p.existingId;
          continue;
        }
        const name = (p.name || "").trim() || "Untitled project";
        const id = crypto.randomUUID();
        const { error } = await supabase
          .from("projects")
          .insert({ id, household_id: householdId, name, lead_id: meId });
        if (error) throw error;
        pid[p.key] = id;
        pCount++;
      }

      const groceryList = state.lists.find((l) => l.kind === "grocery") || null;
      let tCount = 0;
      let gCount = 0;
      for (const it of items) {
        const text = it.text.trim();
        if (!text) continue;
        if (it.dest === "groceries") {
          gCount++;
          if (groceryList) await addToList(groceryList, text);
          continue;
        }
        tCount++;
        const projectId = it.dest === "unsure" || it.dest === "loose" ? null : pid[it.dest] || null;
        const { error } = await supabase.from("tasks").insert({
          household_id: householdId,
          text,
          project_id: projectId,
          owner_id: null,
          done: false,
          unsure: it.dest === "unsure",
        });
        if (error) throw error;
      }

      let rCount = 0;
      for (const r of reviewRoutines) {
        const name = (r.name || "").trim();
        if (!name || !r.days.length) continue;
        const { error } = await supabase.from("routines").insert({
          household_id: householdId,
          name,
          owner_id: null,
          days: [...r.days].sort(),
          followups: r.followups,
        });
        if (error) throw error;
        rCount++;
      }

      return { projects: pCount, tasks: tCount, groceries: gCount, routines: rCount };
    } catch (e) {
      console.error(e);
      toast("That did not save. Try again.");
      return null;
    }
  };

  const value: AppDataContextValue = {
    ...state,
    meId,
    isMe,
    nameOf,
    partner,
    partnerName,
    otherIds,
    today,
    logMap,
    markActivitySeen,
    newTask,
    takeTask,
    releaseTask,
    toggleTask,
    deleteTask,
    placeTask,
    createProject,
    renameProject,
    deleteProject,
    takeLead,
    createRoutine,
    deleteRoutine,
    setRoutineOwner,
    routineTick,
    routineHelp,
    routineUnhelp,
    routineNeedHand,
    routineClaim,
    createTimer,
    timerDone,
    timerSnooze,
    timerCancel,
    createList,
    deleteList,
    addToList,
    toggleListItem,
    deleteListItem,
    clearTicked,
    hideCatalogItem,
    saveDump,
    saveDumpReview,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
