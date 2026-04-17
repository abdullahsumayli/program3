import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BillingPageClient } from "./billing-page-client";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <BillingPageClient />;
}
