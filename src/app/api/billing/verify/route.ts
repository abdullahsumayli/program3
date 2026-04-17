import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { getPayment } from "@/lib/billing/moyasar";

export async function GET(request: Request) {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { workspace } = auth;

  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("id");

  if (!paymentId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const payment = await getPayment(paymentId);

    if (payment.metadata?.workspace_id !== workspace.id) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
    });
  } catch {
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
