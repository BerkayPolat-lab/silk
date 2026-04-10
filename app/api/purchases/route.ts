import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// GET /api/purchases
// Returns the provider_ids the authenticated user already has keys for.
// Used by CartDrawer and AddToCartButton to show "key on file" state.
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_api_keys")
    .select("provider_id")
    .eq("user_id", user.id)
    .not("provider_id", "is", null);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// ---------------------------------------------------------------------------
// POST /api/purchases
// Saves provider API keys for the current user.
//
// Body: { modelIds: string[], apiKeys: Record<providerId, rawKey> }
//   - modelIds: IDs of models being "purchased" (used to resolve provider_ids)
//   - apiKeys: map of provider_id → raw API key (only needed for new providers)
//
// Business rules:
//   1. Auth required
//   2. modelIds must be non-empty
//   3. Every provider not already keyed must have a key >= 8 chars in apiKeys
//   4. One key per provider per user (enforced by DB unique index + 409 on conflict)
//   5. Raw keys are never stored — only SHA-256 hash + first 7 chars as prefix
// ---------------------------------------------------------------------------

type PurchaseBody = {
  modelIds?: unknown;
  apiKeys?: unknown;
};

type ModelRow = {
  id: string;
  provider_id: string;
  providers: { name: string } | null;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PurchaseBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { modelIds, apiKeys } = body;

  if (!Array.isArray(modelIds) || modelIds.length === 0) {
    return NextResponse.json(
      { error: "modelIds must be a non-empty array" },
      { status: 400 }
    );
  }

  if (!apiKeys || typeof apiKeys !== "object" || Array.isArray(apiKeys)) {
    return NextResponse.json(
      { error: "apiKeys must be an object mapping provider_id to key" },
      { status: 400 }
    );
  }

  const keysMap = apiKeys as Record<string, string>;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Resolve provider_id and provider name for each modelId in one query
  const { data: models, error: modelsError } = await supabase
    .from("models")
    .select("id, provider_id, providers(name)")
    .in("id", modelIds as string[]);

  if (modelsError || !models) {
    return NextResponse.json(
      { error: "Failed to look up models" },
      { status: 500 }
    );
  }

  // Build a map of provider_id → provider name from the results
  const providerMap = new Map<string, string>();
  for (const model of (models as unknown) as ModelRow[]) {
    if (model.provider_id) {
      providerMap.set(
        model.provider_id,
        model.providers?.name ?? model.provider_id
      );
    }
  }

  if (providerMap.size === 0) {
    return NextResponse.json(
      { error: "None of the provided modelIds resolved to a known provider" },
      { status: 400 }
    );
  }

  // 2. Fetch providers the user already has keys for (avoid duplicate inserts)
  const { data: existingKeys } = await supabase
    .from("user_api_keys")
    .select("provider_id")
    .eq("user_id", user.id)
    .not("provider_id", "is", null);

  const existingProviderIds = new Set(
    (existingKeys ?? []).map((k) => k.provider_id as string)
  );

  // 3. Determine which providers still need a new key
  const newProviderIds = [...providerMap.keys()].filter(
    (id) => !existingProviderIds.has(id)
  );

  // 4. Validate that every new provider has a usable key in the payload
  const missingProviders = newProviderIds.filter(
    (id) => (keysMap[id] ?? "").trim().length < 8
  );

  if (missingProviders.length > 0) {
    const missingNames = missingProviders.map(
      (id) => providerMap.get(id) ?? id
    );
    return NextResponse.json(
      {
        error: "Missing or invalid API keys for one or more providers",
        missingProviders: missingNames,
      },
      { status: 400 }
    );
  }

  // 5. Insert new keys — skip providers that are already keyed
  if (newProviderIds.length > 0) {
    const rows = newProviderIds.map((providerId) => {
      const raw = (keysMap[providerId] ?? "").trim();
      const key_hash = createHash("sha256").update(raw).digest("hex");
      const key_prefix = raw.slice(0, 7);

      return {
        user_id: user.id,
        provider_id: providerId,
        key_hash,
        key_prefix,
        name: providerMap.get(providerId) ?? "API Key",
      };
    });

    const { error: insertError } = await supabase
      .from("user_api_keys")
      .insert(rows);

    if (insertError) {
      // Unique constraint violation — key already exists for this provider
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "You already have a key on file for one or more of these providers.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to save keys", details: insertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: true, savedCount: newProviderIds.length },
    { status: 201 }
  );
}
