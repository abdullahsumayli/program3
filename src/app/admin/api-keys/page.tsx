import { createAdminClient } from "@/lib/supabase/admin";
import { AdminApiKeysClient } from "./admin-api-keys-client";

export default async function AdminApiKeysPage() {
  const db = createAdminClient();
  void db;
  return <AdminApiKeysClient />;
}
