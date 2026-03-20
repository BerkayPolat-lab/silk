import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CreateReviewBody = {
  rating?: number;
  content?: string;
};

type UserMetadata = {
  display_name?: string;
  full_name?: string;
};

function validateCreateBody(body: CreateReviewBody) {
  const errors: string[] = [];

  if (!Number.isInteger(body.rating) || (body.rating ?? 0) < 1 || (body.rating ?? 0) > 5) {
    errors.push("rating must be an integer between 1 and 5");
  }

  const content = body.content?.trim() ?? "";
  if (content.length < 2) {
    errors.push("content must be at least 2 characters");
  }
  if (content.length > 2000) {
    errors.push("content must be at most 2000 characters");
  }

  return { errors, content };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = (await request.json().catch(() => null)) as CreateReviewBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { errors, content } = validateCreateBody(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: model, error: modelError } = await supabase
    .from("models")
    .select("id")
    .eq("slug", slug)
    .single();

  if (modelError || !model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Optional anti-spam: one review per user/model.
  const { data: existing } = await supabase
    .from("reviews")
    .select("comment_id")
    .eq("model_id", model.id)
    .eq("user_id", user.id)
    .limit(1);

  if ((existing ?? []).length > 0) {
    return NextResponse.json(
      { error: "You have already reviewed this model. Please edit your existing review." },
      { status: 409 }
    );
  }

  const metadata = (user.user_metadata ?? {}) as UserMetadata;
  const authorName =
    metadata.display_name?.trim() ||
    metadata.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Anonymous";

  const { data: inserted, error: insertError } = await supabase
    .from("reviews")
    .insert({
      model_id: model.id,
      user_id: user.id,
      author_name: authorName,
      rating: body.rating,
      content,
    })
    .select("model_id, comment_id, user_id, author_name, rating, content, created_at")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to create review", details: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(inserted, { status: 201 });
}

