// Row shapes mirroring supabase/migrations/0001_init.sql

export type Profile = {
  id: string;
  household_id: string | null;
  display_name: string | null;
  seen_at: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  household_id: string;
  name: string;
  lead_id: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  household_id: string;
  text: string;
  project_id: string | null;
  owner_id: string | null;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
  unsure: boolean;
  created_at: string;
};

export type List = {
  id: string;
  household_id: string;
  name: string;
  kind: string;
  created_at: string;
};

export type ListItem = {
  id: string;
  household_id: string;
  list_id: string;
  text: string;
  done: boolean;
  created_at: string;
};

export type CatalogItem = {
  id: string;
  household_id: string;
  kind: string;
  text: string;
  uses: number;
  gone: boolean;
  created_at: string;
};

export type Dump = {
  id: string;
  household_id: string;
  text: string;
  by: string | null;
  created_at: string;
};

export type FollowupStep = { text: string; afterMin: number };

export type Routine = {
  id: string;
  household_id: string;
  name: string;
  owner_id: string | null;
  days: number[];
  followups: FollowupStep[];
  created_at: string;
};

export type RoutineLog = {
  id: string;
  household_id: string;
  routine_id: string;
  date: string;
  done: boolean;
  done_by: string | null;
  helper_id: string | null;
  needs_hand: boolean;
};

export type ActivityItem = {
  id: string;
  household_id: string;
  type: string;
  by: string | null;
  subject: string | null;
  extra: string | null;
  created_at: string;
};

export type Timer = {
  id: string;
  household_id: string;
  routine_id: string | null;
  routine_name: string | null;
  text: string | null;
  due_at: string;
  rest: FollowupStep[];
  created_by: string | null;
  created_at: string;
};
