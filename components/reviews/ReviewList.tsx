"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ReviewWithOwnership } from "@/types";

const STAR_LABELS = ["Very poor", "Poor", "Average", "Good", "Excellent"];
const MAX_CHARS = 2000;

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl leading-none transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${star} star — ${STAR_LABELS[star - 1]}`}
        >
          <span className={active >= star ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"}>
            ★
          </span>
        </button>
      ))}
      {active > 0 && (
        <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
          {STAR_LABELS[active - 1]}
        </span>
      )}
    </div>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-px leading-none">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`text-base ${rating >= star ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"}`}>
          ★
        </span>
      ))}
    </span>
  );
}

function AuthorAvatar({ name }: { name: string | null }) {
  const initial = (name ?? "A")[0].toUpperCase();
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
      {initial}
    </span>
  );
}

type ReviewListProps = {
  modelSlug: string;
  reviews: ReviewWithOwnership[];
};

export default function ReviewList({ modelSlug, reviews }: ReviewListProps) {
  const router = useRouter();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingRating, setEditingRating] = useState<number>(5);
  const [editingContent, setEditingContent] = useState("");
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  function beginEdit(review: ReviewWithOwnership) {
    setEditingCommentId(review.comment_id);
    setEditingRating(review.rating);
    setEditingContent(review.content ?? "");
    setErrorById((prev) => ({ ...prev, [review.comment_id]: "" }));
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCommentId) return;

    const trimmed = editingContent.trim();
    if (trimmed.length < 2) {
      setErrorById((prev) => ({
        ...prev,
        [editingCommentId]: "Review text must be at least 2 characters.",
      }));
      return;
    }

    setBusyCommentId(editingCommentId);
    try {
      const response = await fetch(
        `/api/models/${modelSlug}/reviews/${editingCommentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: editingRating, content: trimmed }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setErrorById((prev) => ({
          ...prev,
          [editingCommentId]: payload?.error ?? "Failed to update review.",
        }));
        return;
      }

      setEditingCommentId(null);
      setEditingContent("");
      router.refresh();
    } finally {
      setBusyCommentId(null);
    }
  }

  async function deleteReview(commentId: string) {
    setBusyCommentId(commentId);
    setErrorById((prev) => ({ ...prev, [commentId]: "" }));
    try {
      const response = await fetch(`/api/models/${modelSlug}/reviews/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setErrorById((prev) => ({
          ...prev,
          [commentId]: payload?.error ?? "Failed to delete review.",
        }));
        return;
      }

      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingContent("");
      }
      router.refresh();
    } finally {
      setBusyCommentId(null);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-base font-semibold text-zinc-700 dark:text-zinc-300">
        Reviews {reviews.length > 0 && <span className="ml-1 text-zinc-400 font-normal">({reviews.length})</span>}
      </h2>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-8 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">No reviews yet. Be the first to share your experience.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const isEditing = editingCommentId === review.comment_id;
            const isBusy = busyCommentId === review.comment_id;

            return (
              <div
                key={review.comment_id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {isEditing ? (
                  <form onSubmit={submitEdit} className="space-y-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Rating
                      </label>
                      <StarPicker value={editingRating} onChange={setEditingRating} />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Review
                        </label>
                        <span className={`text-xs tabular-nums ${editingContent.length > MAX_CHARS * 0.9 ? "text-amber-500" : "text-zinc-400"}`}>
                          {editingContent.length} / {MAX_CHARS}
                        </span>
                      </div>
                      <textarea
                        value={editingContent}
                        onChange={(event) => setEditingContent(event.target.value)}
                        minLength={2}
                        maxLength={MAX_CHARS}
                        rows={4}
                        required
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/5"
                      />
                    </div>
                    {errorById[review.comment_id] && (
                      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                        {errorById[review.comment_id]}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        {isBusy ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setEditingCommentId(null)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="mb-3 flex items-start gap-3">
                      <AuthorAvatar name={review.author_name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            {review.author_name ?? "Anonymous"}
                          </span>
                          <StarDisplay rating={review.rating} />
                          <span className="text-xs text-zinc-400">
                            {new Date(review.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        {review.content && (
                          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                            {review.content}
                          </p>
                        )}
                      </div>
                    </div>

                    {review.isOwner && (
                      <div className="flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => beginEdit(review)}
                          disabled={isBusy}
                          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteReview(review.comment_id)}
                          disabled={isBusy}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          {isBusy ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}

                    {errorById[review.comment_id] && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {errorById[review.comment_id]}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
