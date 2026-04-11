import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

type Body = {
  sessionId?: unknown;
};

/**
 * Fallback when `checkout.session.completed` webhook did not run (common on localhost
 * without Stripe CLI, or misconfigured webhook secret). Idempotent: same RPC as webhook.
 */
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const metaUser = session.metadata?.supabase_user_id ?? session.client_reference_id ?? null;
    if (!metaUser || metaUser !== user.id) {
      return NextResponse.json({ error: "This payment does not belong to your account" }, { status: 403 });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment is not complete yet", payment_status: session.payment_status },
        { status: 400 }
      );
    }

    const amountTotal = session.amount_total;
    if (amountTotal === null || amountTotal <= 0) {
      return NextResponse.json({ error: "Invalid amount on session" }, { status: 400 });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    const admin = createServiceRoleClient();
    const { data: credited, error } = await admin.rpc("apply_stripe_topup", {
      p_user_id: user.id,
      p_amount_cents: amountTotal,
      p_checkout_session_id: session.id,
      p_payment_intent_id: paymentIntentId,
      p_currency: session.currency ?? "usd",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      credited: credited === true,
      alreadyApplied: credited === false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
