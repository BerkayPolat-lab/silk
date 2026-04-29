---
name: LLM Reviews Feature
overview: Implement an authenticated comment-and-rating feature for each model, using the existing `reviews` table and surfacing live average ratings/review counts on model cards, model details, and provider pages.
todos:
  - id: schema-aggregates
    content: Create migration to add model aggregate columns and trigger/function to recompute model/provider rating stats on review changes.
    status: completed
  - id: review-write-apis
    content: Implement POST/PATCH/DELETE review endpoints under app/api/models/[slug]/reviews.
    status: completed
  - id: review-ui-form
    content: Add ReviewForm component on model detail page with auth-aware submit flow.
    status: completed
  - id: review-ui-actions
    content: Add edit/delete controls for current user’s own reviews.
    status: completed
  - id: rating-display
    content: Show model avg+count on home cards, model header, and provider model list; keep provider aggregate display.
    status: completed
  - id: types-and-tests
    content: Update shared types and verify auth, aggregate correctness, and UI behavior.
    status: completed
isProject: false
---

# LLM Comment + Rating Plan

## Current State Analysis

- `reviews` already stores per-model comments with composite PK (`model_id`, `comment_id`), optional `user_id`, `author_name`, `rating` (1-5), `content`, and `created_at` in `[/Users/berkaypolat/Desktop/silk/supabase/migrations/00002_create_tables.sql](/Users/berkaypolat/Desktop/silk/supabase/migrations/00002_create_tables.sql)`.
- RLS currently supports:
  - public read
  - authenticated insert
  - update-own (`auth.uid() = user_id`)
- Model details page already reads and renders review rows in `[/Users/berkaypolat/Desktop/silk/app/models/[slug]/page.tsx](/Users/berkaypolat/Desktop/silk/app/models/[slug]/page.tsx)`.
- Home and provider pages currently display provider-level rating fields (`providers.avg_rating`, `providers.total_reviews`) from `[/Users/berkaypolat/Desktop/silk/app/page.tsx](/Users/berkaypolat/Desktop/silk/app/page.tsx)` and `[/Users/berkaypolat/Desktop/silk/app/providers/[slug]/page.tsx](/Users/berkaypolat/Desktop/silk/app/providers/[slug]/page.tsx)`.

## Goal

Add end-to-end review writing and rating aggregation so users can:

1. submit comments/ratings per model,
2. see updated average rating + review count,
3. view review list with optional edit/delete controls for their own reviews.

## Implementation Plan

### 1) Add review write APIs (server-side)

- Create route handlers:
  - `[/Users/berkaypolat/Desktop/silk/app/api/models/[slug]/reviews/route.ts](/Users/berkaypolat/Desktop/silk/app/api/models/[slug]/reviews/route.ts)`: `POST` create review.
  - `[/Users/berkaypolat/Desktop/silk/app/api/models/[slug]/reviews/[commentId]/route.ts](/Users/berkaypolat/Desktop/silk/app/api/models/[slug]/reviews/[commentId]/route.ts)`: `PATCH` update own review, `DELETE` delete own review.
- Validation rules:
  - `rating` required integer 1..5
  - `content` non-empty, bounded length (e.g. 2..2000 chars)
  - model exists by slug
- Auth:
  - require logged-in user for create/update/delete
  - set `user_id = auth.uid()` server-side
  - set `author_name` from user email/profile (fallback `Anonymous`)

### 2) Add aggregation source of truth (model + provider)

- Add SQL function in new migration (e.g. `00007_review_aggregates.sql`) to recompute:
  - per-model `avg_rating`, `total_reviews`
  - per-provider `avg_rating`, `total_reviews` from all provider models
- Add `avg_rating` + `total_reviews` columns to `models` (recommended for fast list rendering).
- Add DB trigger on `reviews` `INSERT/UPDATE/DELETE` to refresh aggregates automatically.

Why this approach:

- Keeps reads fast for landing/provider pages.
- Avoids expensive runtime aggregate queries in every page render.

### 3) Update read APIs to return aggregate fields

- Extend model list/detail payloads:
  - `[/Users/berkaypolat/Desktop/silk/app/api/models/route.ts](/Users/berkaypolat/Desktop/silk/app/api/models/route.ts)`
  - `[/Users/berkaypolat/Desktop/silk/app/api/models/[slug]/route.ts](/Users/berkaypolat/Desktop/silk/app/api/models/[slug]/route.ts)`
- Include model-level `avg_rating` and `total_reviews`.

### 4) Build review form + interactions on model page

- Add client component:
  - `[/Users/berkaypolat/Desktop/silk/components/reviews/ReviewForm.tsx](/Users/berkaypolat/Desktop/silk/components/reviews/ReviewForm.tsx)`
- Place it in model detail page:
  - `[/Users/berkaypolat/Desktop/silk/app/models/[slug]/page.tsx](/Users/berkaypolat/Desktop/silk/app/models/[slug]/page.tsx)`
- UX behavior:
  - if logged out: show “Sign in to leave a review” CTA
  - if logged in: show star input + textarea + submit
  - optimistic update or refresh after successful submit
  - show inline validation + API errors

### 5) Add own-review edit/delete controls

- Add review item client control component:
  - `[/Users/berkaypolat/Desktop/silk/components/reviews/ReviewItemActions.tsx](/Users/berkaypolat/Desktop/silk/components/reviews/ReviewItemActions.tsx)`
- Only render actions if `review.user_id === currentUser.id`.
- Use `PATCH` and `DELETE` endpoints from Step 1.

### 6) Surface averages/review counts across app

- Home cards: show model-level stars + count in `[/Users/berkaypolat/Desktop/silk/app/page.tsx](/Users/berkaypolat/Desktop/silk/app/page.tsx)`.
- Model detail header: show model-level avg + count near title in `[/Users/berkaypolat/Desktop/silk/app/models/[slug]/page.tsx](/Users/berkaypolat/Desktop/silk/app/models/[slug]/page.tsx)`.
- Provider page:
  - keep provider-level aggregate display from `providers`.
  - optionally list each model’s avg + count in `[/Users/berkaypolat/Desktop/silk/app/providers/[slug]/page.tsx](/Users/berkaypolat/Desktop/silk/app/providers/[slug]/page.tsx)`.

### 7) Type updates

- Update review/model types in `[/Users/berkaypolat/Desktop/silk/types/index.ts](/Users/berkaypolat/Desktop/silk/types/index.ts)`:
  - `Review` add `user_id`.
  - `Model` / `ModelDetail` add `avg_rating`, `total_reviews`.

### 8) Security and abuse controls

- Enforce server-side input validation.
- Add lightweight per-user rate limiting for review writes (e.g., max N per hour).
- Optionally prevent duplicate spam by requiring one review per user per model (either policy or app logic).

### 9) Testing checklist

- Auth tests:
  - logged-out create/update/delete blocked
  - logged-in create works
  - user can only update/delete own review
- Data tests:
  - averages/counts update correctly on insert/update/delete
  - provider aggregate updates when model reviews change
- UI tests:
  - model page shows new review immediately
  - stars/counts update on home/provider pages

## Suggested rollout order

1. Migration + aggregate trigger
2. Write APIs
3. Model page review form
4. Edit/delete actions
5. Home/provider rating display updates
6. Final validation + QA

