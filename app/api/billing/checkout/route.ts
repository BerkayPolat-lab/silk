import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_CENTS = 50;
const MAX_CENTS = 1_000_000_00;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

type Body = {
  amountCents?: unknown;
  currency?: unknown;
};

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
  const rawAmount = body?.amountCents;
  const amountCents = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
  const currencyRaw = typeof body?.currency === "string" ? body.currency : "usd";
  const currency = currencyRaw.toLowerCase().slice(0, 3) || "usd";

  if (
    !Number.isFinite(amountCents) ||
    !Number.isInteger(amountCents) ||
    amountCents < MIN_CENTS ||
    amountCents > MAX_CENTS
  ) {
    return NextResponse.json(
      {
        error: `amountCents must be an integer between ${MIN_CENTS} and ${MAX_CENTS}`,
      },
      { status: 400 }
    );
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: "Silk balance top-up" },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel`,
      metadata: { supabase_user_id: user.id },
      client_reference_id: user.id,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
