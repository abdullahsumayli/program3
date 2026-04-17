import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { getPayment } from "@/lib/billing/moyasar";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("id");

  if (!paymentId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const payment = await getPayment(paymentId);
    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
