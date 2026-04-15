import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookSignature } from "@/lib/billing/moyasar";
import { sendEmail } from "@/lib/email/client";
import { subscriptionFailedEmail } from "@/lib/email/templates";

type MoyasarWebhook = {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    metadata?: {
      workspace_id?: string;
      plan?: string;
    };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-moyasar-signature");

  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MoyasarWebhook;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workspaceId = payload.data?.metadata?.workspace_id;
  const paymentId = payload.data?.id;
  const status = payload.data?.status;
  const eventType = payload.type ?? "unknown";

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id missing in metadata" }, { status: 400 });
  }

  const supabase = createServiceClient();

  await supabase.from("subscription_events").insert({
    workspace_id: workspaceId,
    event_type: eventType,
    moyasar_payment_id: paymentId ?? null,
    moyasar_payload: payload,
  });

  const isPaid = eventType === "payment_paid" || status === "paid";
  const isFailed = eventType === "payment_failed" || status === "failed";
  const isRefunded = eventType === "payment_refunded" || status === "refunded";

  if (isPaid) {
    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);
    await supabase
      .from("workspaces")
      .update({
        plan: "paid",
        subscription_status: "active",
        subscription_renews_at: renewsAt.toISOString(),
        moyasar_subscription_id: paymentId ?? null,
      })
      .eq("id", workspaceId);
  } else if (isFailed) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("name, owner_id")
      .eq("id", workspaceId)
      .maybeSingle();

    await supabase
      .from("workspaces")
      .update({ subscription_status: "past_due" })
      .eq("id", workspaceId);

    if (ws?.owner_id) {
      const { data: owner } = await supabase.auth.admin.getUserById(ws.owner_id);
      const email = owner?.user?.email;
      if (email) {
        const { subject, html } = subscriptionFailedEmail({
          workspaceName: ws.name,
          appUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/billing`,
        });
        try {
          await sendEmail({ to: email, subject, html });
        } catch (err) {
          console.error("[webhook] failed to send subscription-failed email", err);
        }
      }
    }
  } else if (isRefunded) {
    await supabase
      .from("workspaces")
      .update({ plan: "free", subscription_status: "canceled" })
      .eq("id", workspaceId);
  }

  return NextResponse.json({ ok: true });
}
