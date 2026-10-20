import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppDataProvider } from "@/lib/store";
import { ToastProvider } from "@/lib/toast";
import AppShell from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) redirect("/onboarding");

  return (
    <ToastProvider>
      <AppDataProvider householdId={profile.household_id} meId={user.id}>
        <AppShell>{children}</AppShell>
      </AppDataProvider>
    </ToastProvider>
  );
}
