"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ReviewFormProps = {
  modelSlug: string;
};

export default function ReviewForm({ modelSlug }: ReviewFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [rating, setRating] = useState<number>(5);
  const [content, setContent] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setIsAuthenticated(Boolean(user));
    }

    void loadUser();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedContent = content.trim();
    if (trimmedContent.length < 2) {
      setError("Review text must be at least 2 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/models/${modelSlug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, content: trimmedContent }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Failed to submit review.");
        return;
      }

      setContent("");
      setRating(5);
      setSuccess("Review submitted.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated === null) {
    return (
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Leave a Review</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Checking session...</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Leave a Review</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Please{" "}
          <Link href="/login" className="font-medium hover:underline">
            sign in
          </Link>{" "}
          to leave a review.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">Leave a Review</h2>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <label htmlFor="rating" className="mb-1 block text-sm font-medium">
            Rating
          </label>
          <select
            id="rating"
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
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
          <label htmlFor="content" className="mb-1 block text-sm font-medium">
            Your review
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            minLength={2}
            maxLength={2000}
            required
            rows={4}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="What worked well, and what did not?"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting ? "Submitting..." : "Submit review"}
        </button>
      </form>
    </section>
  );
}

