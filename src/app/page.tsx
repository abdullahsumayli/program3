import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanyDashboard } from "@/components/dashboard/company-dashboard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CompanyDashboard />;
}
