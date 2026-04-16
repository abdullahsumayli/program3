import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanySettingsClient } from "./company-settings-client";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <CompanySettingsClient />;
}
