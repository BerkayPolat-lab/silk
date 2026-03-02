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
      description,
      highlights,
      api_docs,
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

  const { data: reviews } = await supabase
    .from("reviews")
      .select("model_id, comment_id, author_name, rating, content, created_at")
    .eq("model_id", model.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    ...model,
    reviews: reviews ?? [],
  });
}
