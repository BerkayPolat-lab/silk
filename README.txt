Video file:
https://drive.google.com/file/d/1ghKhcHK1U0ynr84F8CK1SkWr2FSLnFXQ/view?usp=sharing

Where to Find Implementation of Required Items:
Backend API Endpoints:
    •    route.ts (api/models) — GET /api/models: Fetches all models from the database, joined with provider and company information. Supports optional filtering by provider slug via query parameter.
    •    route.ts (api/models/[slug]) — GET /api/models/[slug]: Fetches full details for a single model by its slug, including associated reviews ordered by most recent.
    •    route.ts (api/models/[slug]/reviews) — POST /api/models/[slug]/reviews: Creates a new review for a model. Requires authentication, validates rating (1–5) and content length, and enforces one review per user per model.
    •    route.ts (api/models/[slug]/reviews/[commentId]) — PATCH: Edits an existing review. Verifies the requesting user is the original author before allowing any update. — DELETE: Deletes a review. Verifies ownership before deletion.
    •    route.ts (api/sandbox/chat) — POST /api/sandbox/chat: Streams a chat response from a selected LLM via LiteLLM and OpenRouter. Includes authentication, per-user rate limiting, message validation, and real-time streaming via Server-Sent Events.
Frontend Pages:
    •    page.tsx (app/(auth)/signup) — User registration page
    •    page.tsx (app/(auth)/login) — User login page
    •    page.tsx (app) — Home/marketplace page displaying all models
    •    page.tsx (app/models/[slug]) — Individual model detail page
    •    page.tsx (app/sandbox/[modelSlug]) — Sandbox chat page for a specific model
    •    page.tsx (app/dashboard) — User dashboard page
Frontend Components:
    •    ReviewForm.tsx — Form for submitting a new review
    •    ReviewList.tsx — Displays all reviews for a model with edit and delete functionality
    •    SandboxChat.tsx — Full chat interface connecting to the sandbox API
