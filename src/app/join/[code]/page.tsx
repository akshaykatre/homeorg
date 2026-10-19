import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import JoinButton from "./join-button";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-xl font-semibold">You&apos;ve been invited to Home Base</h1>

      {user ? (
        <JoinButton code={code} />
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white"
        >
          Sign in to join
        </Link>
      )}
    </main>
  );
}
