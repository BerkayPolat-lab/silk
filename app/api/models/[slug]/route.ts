import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: model, error: modelError } = await supabase
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
      documentation_url,
      output_examples,
      providers (
        id,
        name,
        slug,
        avg_rating,
        companies (
          id,
          name,
          logo_url,
          website
        )
      )
    `
    )
    .eq("slug", slug)
    .single();

  if (modelError || !model) {
    return NextResponse.json(
      { error: modelError?.message ?? "Model not found" },
      { status: 404 }
    );
  }

  const [{ data: products }, { data: reviews }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("model_id", model.id)
      .order("token_limit", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, author_name, rating, content, created_at")
      .eq("model_id", model.id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    ...model,
    products: products ?? [],
    reviews: reviews ?? [],
  });
}
