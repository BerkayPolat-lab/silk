import { createClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";

function generatePlatformKey(): string {
  const suffix = randomBytes(32).toString("base64url");
  return `sk_${suffix}`;
}

// POST /api/keys — mint a single Silk platform API key (plaintext returned once).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .maybeSingle();

  const balanceCents = wallet?.balance_cents ?? 0;
  if (balanceCents <= 0) {
    return NextResponse.json(
      {
        error:
          "Add funds to your account before creating an API key. Use Add funds in the header or billing page.",
        code: "INSUFFICIENT_FUNDS",
      },
      { status: 402 }
    );
  }

  const { data: existing } = await supabase
    .from("user_api_keys")
    .select("id")
    .eq("user_id", user.id)
    .eq("key_type", "platform")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error:
          "You already have a Silk platform API key. It is only shown once at creation.",
        code: "KEY_EXISTS",
      },
      { status: 409 }
    );
  }

  const rawKey = generatePlatformKey();
  const key_hash = createHash("sha256").update(rawKey).digest("hex");
  const key_prefix = rawKey.slice(0, 7);

  const { error: insertError } = await supabase.from("user_api_keys").insert({
    user_id: user.id,
    key_hash,
    key_prefix,
    key_type: "platform",
    name: "Silk platform key",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        {
          error:
            "A platform key already exists for this account.",
          code: "KEY_EXISTS",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create API key", details: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ apiKey: rawKey }, { status: 201 });
}
