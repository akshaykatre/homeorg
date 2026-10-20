"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function JoinButton({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: joinError } = await supabase.rpc("join_household", {
      invite_code: code,
    });

    if (joinError) {
      setError(joinError.message);
      setBusy(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleJoin}
        disabled={busy}
        className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? "Joining..." : "Join household"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
