import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntegrationsSettingsClient } from "./integrations-settings-client";

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <IntegrationsSettingsClient />;
}
