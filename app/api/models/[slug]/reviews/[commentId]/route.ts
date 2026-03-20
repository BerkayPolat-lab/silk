import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type UpdateReviewBody = {
  rating?: number;
  content?: string;
};

function validateUpdateBody(body: UpdateReviewBody) {
  const hasRating = body.rating !== undefined;
  const hasContent = body.content !== undefined;
  const errors: string[] = [];

  if (!hasRating && !hasContent) {
    errors.push("Provide at least one field to update");
  }

  if (hasRating) {
    if (!Number.isInteger(body.rating) || (body.rating ?? 0) < 1 || (body.rating ?? 0) > 5) {
      errors.push("rating must be an integer between 1 and 5");
    }
  }

  if (hasContent) {
    const c = body.content?.trim() ?? "";
    if (c.length < 2) errors.push("content must be at least 2 characters");
    if (c.length > 2000) errors.push("content must be at most 2000 characters");
  }

  return { errors };
}

async function resolveModelIdBySlug(supabase: Awaited<ReturnType<typeof createClient>>, slug: string) {
  const { data: model, error } = await supabase
    .from("models")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error || !model) return null;
  return model.id as string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; commentId: string }> }
) {
  const { slug, commentId } = await params;
  const body = (await request.json().catch(() => null)) as UpdateReviewBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { errors } = validateUpdateBody(body);
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

  const modelId = await resolveModelIdBySlug(supabase, slug);
  if (!modelId) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("reviews")
    .select("model_id, comment_id, user_id")
    .eq("model_id", modelId)
    .eq("comment_id", commentId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (body.rating !== undefined) updatePayload.rating = body.rating;
  if (body.content !== undefined) updatePayload.content = body.content.trim();

  const { data: updated, error: updateError } = await supabase
    .from("reviews")
    .update(updatePayload)
    .eq("model_id", modelId)
    .eq("comment_id", commentId)
    .select("model_id, comment_id, user_id, author_name, rating, content, created_at")
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update review", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; commentId: string }> }
) {
  const { slug, commentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const modelId = await resolveModelIdBySlug(supabase, slug);
  if (!modelId) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("reviews")
    .select("model_id, comment_id, user_id")
    .eq("model_id", modelId)
    .eq("comment_id", commentId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("reviews")
    .delete()
    .eq("model_id", modelId)
    .eq("comment_id", commentId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete review", details: deleteError.message },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}

