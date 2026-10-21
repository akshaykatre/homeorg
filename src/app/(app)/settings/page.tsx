"use client";

import { useState } from "react";
import { useAppData } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { profiles, meId, nameOf } = useAppData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const full = profiles.length >= 2;

  async function handleInvite() {
    setBusy(true);
    setError(null);
    setCopied(false);
    const supabase = createClient();
    const { data, error: inviteError } = await supabase
      .rpc("create_household_invite")
      .single<{ code: string }>();
    setBusy(false);
    if (inviteError) {
      setError(inviteError.message);
      return;
    }
    setInviteLink(`${window.location.origin}/join/${data.code}`);
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
  }

  return (
    <div className="panel">
      <div className="label">Members</div>
      <ul>
        {profiles.map((p) => (
          <li key={p.id}>{p.id === meId ? "You" : nameOf(p.id)}</li>
        ))}
      </ul>

      <div className="label">Invite someone</div>
      {full ? (
        <p className="hint">This household already has two members.</p>
      ) : (
        <>
          <p className="hint">
            Make sure their account already exists (sign-ups are restricted), then send them
            this link. It works once and expires in 7 days.
          </p>
          <button className="btn sm" type="button" onClick={handleInvite} disabled={busy}>
            {busy ? "Generating..." : "Generate invite link"}
          </button>
          {inviteLink && (
            <div className="row">
              <code className="break-all">{inviteLink}</code>
              <button className="linkbtn" type="button" onClick={copyLink}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          {error && <p className="sub">{error}</p>}
        </>
      )}
    </div>
  );
}
