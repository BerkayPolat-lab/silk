import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerSlug = searchParams.get("provider");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("models")
    .select(
      `
      id,
      name,
      slug,
      token_count,
      status,
      description,
      highlights,
      rank_order,
      providers (
        id,
        name,
        slug,
        avg_rating,
        companies (
          name,
          logo_url
        )
      )
    `
    )
    .order("rank_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let models = data ?? [];
  if (providerSlug) {
    models = models.filter(
      (m) => (m.providers as { slug?: string } | null)?.slug === providerSlug
    );
  }

  return NextResponse.json(models);
}
