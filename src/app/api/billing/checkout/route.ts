import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { PLANS } from "@/lib/billing/plans";
import { createPayment } from "@/lib/billing/moyasar";

export async function POST() {
  const auth = await requireWorkspace("owner");
  if (auth.error) return auth.error;
  const { workspace } = auth;

  if (workspace.plan === "paid" && workspace.subscription_status === "active") {
    return NextResponse.json(
      { error: "Workspace is already on the paid plan" },
      { status: 400 }
    );
  }

  const plan = PLANS.paid;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const callbackUrl = `${appUrl}/settings/billing?checkout=return`;

  try {
    const payment = await createPayment({
      amountSAR: plan.priceSAR,
      description: `${plan.name} plan — workspace ${workspace.name}`,
      callbackUrl,
      metadata: {
        workspace_id: workspace.id,
        plan: plan.id,
      },
    });

    return NextResponse.json({
      paymentId: payment.id,
      redirectUrl: payment.source?.transaction_url ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
