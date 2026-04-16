import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsersSettingsClient } from "./users-settings-client";

export default async function UsersSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <UsersSettingsClient />;
}
