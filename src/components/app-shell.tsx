"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppData } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { eventText } from "@/lib/activity-text";
import { createClient } from "@/lib/supabase/client";
import { useNow } from "@/lib/use-now";
import ActivitySheet from "./activity-sheet";

const TABS: { href: string; label: string; bubble?: "grab" | "due" }[] = [
  { href: "/home", label: "Home", bubble: "due" },
  { href: "/dump", label: "Dump" },
  { href: "/board", label: "Board", bubble: "grab" },
  { href: "/lists", label: "Lists" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tasks, timers, activity, profiles, meId, isMe, nameOf, markActivitySeen } =
    useAppData();
  const toast = useToast();
  const [activityOpen, setActivityOpen] = useState(false);
  const [feedSince, setFeedSince] = useState(0);
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const startedAt = useRef(0);
  const now = useNow();

  useEffect(() => {
    if (!initialized.current) {
      activity.forEach((a) => seenIds.current.add(a.id));
      initialized.current = true;
      startedAt.current = Date.now();
      return;
    }
    activity.forEach((a) => {
      if (seenIds.current.has(a.id)) return;
      seenIds.current.add(a.id);
      const ts = new Date(a.created_at).getTime();
      if (a.by && !isMe(a.by) && ts >= startedAt.current - 5000) {
        toast(eventText(a, nameOf, isMe));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  const grabCount = tasks.filter((t) => !t.done && !t.owner_id).length;
  const dueCount = timers.filter((t) => new Date(t.due_at).getTime() <= now).length;
  const me = profiles.find((p) => p.id === meId);
  const lastSeen = me?.last_seen_at ? new Date(me.last_seen_at).getTime() : 0;
  const unread = activity.filter(
    (a) => a.by && !isMe(a.by) && new Date(a.created_at).getTime() > lastSeen,
  ).length;

  const today = new Date(now).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/home" className="brand">
          <h1>Home Base</h1>
          <div className="date">{today}</div>
        </Link>
        <div className="hdr-r">
          <button
            className="bell"
            type="button"
            onClick={() => {
              setFeedSince(lastSeen);
              setActivityOpen(true);
              markActivitySeen();
            }}
            aria-label="Activity"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unread > 0 && <span className="bellbadge">{unread}</span>}
          </button>
          <Link className="linkbtn" href="/settings">
            Settings
          </Link>
          <button className="linkbtn" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {children}

      <nav className="tabs" aria-label="Sections">
        <div className="tabs-in">
          {TABS.map((t) => {
            const current = pathname === t.href;
            const n = t.bubble === "grab" ? grabCount : t.bubble === "due" ? dueCount : 0;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="tab"
                aria-current={current ? "page" : undefined}
              >
                {t.label}
                {n > 0 && <span className="bubble">{n}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {activityOpen && (
        <ActivitySheet since={feedSince} onClose={() => setActivityOpen(false)} />
      )}
    </div>
  );
}
