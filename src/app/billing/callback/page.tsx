import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BillingCallbackClient } from "./billing-callback-client";

export default async function BillingCallbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <BillingCallbackClient />;
}
