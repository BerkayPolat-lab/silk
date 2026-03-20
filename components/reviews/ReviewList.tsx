"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ReviewWithOwnership } from "@/types";

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

  if (reviews.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold">Reviews</h2>
      <div className="space-y-4">
        {reviews.map((review) => {
          const isEditing = editingCommentId === review.comment_id;
          const isBusy = busyCommentId === review.comment_id;

          return (
            <div
              key={review.comment_id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="flex text-amber-500">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>
                <span className="text-sm font-medium">
                  {review.author_name ?? "Anonymous"}
                </span>
                <span className="text-sm text-zinc-500">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>

              {isEditing ? (
                <form onSubmit={submitEdit} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor={`rating-${review.comment_id}`}>
                      Rating
                    </label>
                    <select
                      id={`rating-${review.comment_id}`}
                      value={editingRating}
                      onChange={(event) => setEditingRating(Number(event.target.value))}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                    >
                      <option value={5}>5 - Excellent</option>
                      <option value={4}>4 - Good</option>
                      <option value={3}>3 - Average</option>
                      <option value={2}>2 - Poor</option>
                      <option value={1}>1 - Very poor</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor={`content-${review.comment_id}`}>
                      Review
                    </label>
                    <textarea
                      id={`content-${review.comment_id}`}
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                      minLength={2}
                      maxLength={2000}
                      rows={4}
                      required
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </div>
                  {errorById[review.comment_id] && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {errorById[review.comment_id]}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      {isBusy ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setEditingCommentId(null)}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {review.content && (
                    <p className="text-zinc-600 dark:text-zinc-400">{review.content}</p>
                  )}
                  {review.isOwner && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(review)}
                        disabled={isBusy}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteReview(review.comment_id)}
                        disabled={isBusy}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
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
    </section>
  );
}

