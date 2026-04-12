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

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, skipped: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.supabase_user_id ?? session.client_reference_id ?? null;
  const amountTotal = session.amount_total;
  const sessionId = session.id;

  if (!userId || !sessionId) {
    return NextResponse.json({ error: "Missing user or session id in Stripe payload" }, { status: 400 });
  }

  if (amountTotal === null || amountTotal <= 0) {
    return NextResponse.json({ received: true, skipped: "zero amount" });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const supabase = createServiceRoleClient();
  const { data: applied, error } = await supabase.rpc("apply_stripe_topup", {
    p_user_id: userId,
    p_amount_cents: amountTotal,
    p_checkout_session_id: sessionId,
    p_payment_intent_id: paymentIntentId,
    p_currency: session.currency ?? "usd",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true, credited: applied === true });
}
