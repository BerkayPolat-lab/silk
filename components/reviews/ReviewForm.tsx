"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STAR_LABELS = ["Very poor", "Poor", "Average", "Good", "Excellent"];
const MAX_CHARS = 2000;

function StarPicker({
  value,
  onChange,
  size = "lg",
}: {
  value: number;
  onChange: (n: number) => void;
  size?: "sm" | "lg";
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  const textSize = size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className={`${textSize} leading-none transition-transform hover:scale-110 focus:outline-none`}
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
      setSuccess("Review submitted successfully.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated === null) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-zinc-700 dark:text-zinc-300">Leave a Review</h2>
        <p className="text-sm text-zinc-400">Checking session...</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-zinc-700 dark:text-zinc-300">Leave a Review</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Please{" "}
          <Link href="/login" className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-200">
            sign in
          </Link>{" "}
          to leave a review.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-700 dark:text-zinc-300">Leave a Review</h2>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Rating
          </label>
          <StarPicker value={rating} onChange={setRating} size="lg" />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="content" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Your review
            </label>
            <span className={`text-xs tabular-nums ${content.length > MAX_CHARS * 0.9 ? "text-amber-500" : "text-zinc-400"}`}>
              {content.length} / {MAX_CHARS}
            </span>
          </div>
          <textarea
            id="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            minLength={2}
            maxLength={MAX_CHARS}
            required
            rows={4}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/5"
            placeholder="What worked well, and what did not?"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            ✓ {success}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Submitting..." : "Submit review"}
        </button>
      </form>
    </section>
  );
}
