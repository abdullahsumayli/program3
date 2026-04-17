import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { PLANS, isPaidPlan, type PlanId } from "@/lib/billing/plans";
import { createPayment } from "@/lib/billing/moyasar";

export async function POST(request: Request) {
  const auth = await requireWorkspace("owner");
  if (auth.error) return auth.error;
  const { workspace } = auth;

  const body = await request.json().catch(() => ({}));
  const planId = (body.plan ?? "basic") as PlanId;

  if (!isPaidPlan(planId) || !(planId in PLANS)) {
    return NextResponse.json(
      { error: "Invalid plan. Choose basic, pro, or enterprise." },
      { status: 400 }
    );
  }

  if (workspace.plan === planId && workspace.subscription_status === "active") {
    return NextResponse.json(
      { error: "Workspace is already on this plan" },
      { status: 400 }
    );
  }

  const plan = PLANS[planId];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const callbackUrl = `${appUrl}/billing/callback`;

  try {
    const payment = await createPayment({
      amountSAR: plan.priceSAR,
      description: `${plan.name} plan — ${workspace.name}`,
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
