import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BillingSettingsClient } from "./billing-settings-client";

export default async function BillingSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <BillingSettingsClient />;
}
