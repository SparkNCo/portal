# Spark Stack

This repository is a full-stack production template designed for teams using:
	•	Next.js for the UI
	•	Supabase Functions for backend services
	•	Prisma + PostgreSQL for data
	•	Zod → OpenAPI for API contracts and docs
	•	Upstash Redis for server-side caching
	•	Resend + react-email for transactional email
	•	PostHog for analytics and logging
	•	Playwright for E2E testing

Important
Architecture and boundaries are enforced by convention and by AI.md.
Read that file before making changes.

⸻

## Prerequisites

You’ll need:
	•	Node.js 18+
	•	npm or pnpm
	•	Git
	•	Accounts for:
	•	Supabase
	•	Vercel
	•	Upstash
	•	Resend
	•	PostHog

⸻

## Environment variables

Copy the example file:

cp .env.example .env.local

Typical variables:

DATABASE_URL=postgresql://...

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

RESEND_API_KEY=

POSTHOG_KEY=
POSTHOG_HOST=https://app.posthog.com

Rule: Secrets are never committed.
.env.example documents required variables only.

⸻

## Running the project locally

Install dependencies

npm install

Run the UI (Next.js)

npm run dev

	•	App runs at http://localhost:3000
	•	UI code lives in app/ and components/

Run Supabase functions locally

supabase start
supabase functions serve

Functions will be available under:

http://localhost:54321/functions/v1/<service>

Example:

/functions/v1/health


⸻

## Deploying the UI (Vercel)
	1.	Push the repo to GitHub
	2.	In Vercel:
	•	Import the repository
	•	Framework preset: Next.js
	3.	Set environment variables in Vercel:
	•	Same values as .env.local
	4.	Deploy

Vercel will:
	•	Build the UI
	•	Host static + server components
	•	Handle preview deployments automatically

Only UI code is deployed to Vercel.
Backend logic lives in Supabase Functions.

⸻

## Deploying backend functions (Supabase)

Login & link project

supabase login
supabase link --project-ref <your-project-ref>

Deploy all functions

supabase functions deploy

Or deploy a single service:

supabase functions deploy users

Each folder under functions/ is a service boundary.

⸻

## Database schema & migrations (Prisma)

Generate Prisma client

npx prisma generate

Create a migration

npx prisma migrate dev --name init

This will:
	•	Update prisma/migrations/
	•	Keep schema changes versioned

Deploy migrations (production)

npx prisma migrate deploy

Rule:
Prisma is only used inside functions/**.
UI code never talks to the database directly.

⸻

## Zod → OpenAPI docs

How it works
	•	Public API schemas are written in Zod
	•	Zod schemas include OpenAPI metadata
	•	Prisma-generated Zod schemas are internal only
	•	OpenAPI generation is centralized

Files involved

functions/**/schemas/   → public API contracts
lib/openapi/registry.ts
lib/openapi/document.ts

Generating OpenAPI docs

Typically done via a script:

npm run openapi:generate

This produces:

docs/openapi.json

You can then:
	•	Open it in Swagger UI
	•	Import into Postman
	•	Use it for client generation

⸻

## Email system (Resend + react-email)

Structure

functions/email/
  index.ts
  templates/
    welcome-email.tsx

Rules
	•	Email templates are React components
	•	Emails are sent only from backend functions
	•	UI never sends email directly

This keeps secrets safe and audit-friendly.

⸻

## Caching (Upstash Redis)

Redis is used for:
	•	Read-heavy endpoints
	•	Expensive external calls
	•	Rate-limiting or deduplication

Rules
	•	Redis client lives in lib/redis.ts
	•	Redis is only imported in functions
	•	Never used in React components

⸻

## Analytics & logging (PostHog)

PostHog is used for:
	•	Client-side analytics
	•	Server-side event logging
	•	Lightweight observability

Usage
	•	Client initialization in app/providers.tsx
	•	Server usage via lib/posthog.ts

This allows:
	•	Full funnel tracking
	•	Debugging production behavior
	•	Privacy-aware analytics

⸻

## Testing (Playwright)

Structure

tests/
  e2e/
  helpers/
  fixtures/

Run tests

npx playwright test

Tests:
	•	Hit real HTTP endpoints
	•	Validate deployed or local services
	•	Avoid mocking internal implementation details

⸻

## Diagrams & documentation

Mermaid diagrams
	•	System-level: workflows/
	•	Service-level: functions/<service>/diagrams/

These diagrams are:
	•	Part of the source of truth
	•	Required for non-trivial features
	•	AI-readable and human-readable

