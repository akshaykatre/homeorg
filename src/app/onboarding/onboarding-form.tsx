"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingForm() {
  const supabase = createClient();

  const [householdName, setHouseholdName] = useState("Our home");
  const [joinCode, setJoinCode] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: createError } = await supabase.rpc("create_household", {
      household_name: householdName,
    });
    if (createError) {
      setError(createError.message);
      setBusy(false);
      return;
    }

    const { data: invite, error: inviteError } = await supabase
      .rpc("create_household_invite")
      .single<{ code: string }>();
    if (inviteError) {
      setError(inviteError.message);
      setBusy(false);
      return;
    }

    setInviteLink(`${window.location.origin}/join/${invite.code}`);
    setBusy(false);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: joinError } = await supabase.rpc("join_household", {
      invite_code: joinCode.trim(),
    });

    if (joinError) {
      setError(joinError.message);
      setBusy(false);
      return;
    }

    window.location.href = "/";
  }

  if (inviteLink) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <h1 className="text-xl font-semibold">Household created</h1>
        <p className="text-sm text-neutral-600">
          Send this link to your partner so they can join:
        </p>
        <code className="break-all rounded-md bg-neutral-100 p-3 text-sm">
          {inviteLink}
        </code>
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-md bg-neutral-900 px-3 py-2 text-white"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Set up your household</h1>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label className="text-sm font-medium">Create a new household</label>
          <input
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
          >
            Create household
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        or
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-3">
        <label className="text-sm font-medium">Join with an invite code</label>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Invite code"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy || !joinCode.trim()}
          className="rounded-md border border-neutral-900 px-3 py-2 disabled:opacity-50"
        >
          Join household
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
