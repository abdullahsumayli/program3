import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptClient } from "./invite-accept-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return <InviteAcceptClient token={token} />;
}
