import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationsSettingsClient } from "./notifications-settings-client";

export default async function NotificationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <NotificationsSettingsClient />;
}
