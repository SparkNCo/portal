# AI Instructions (Non-Negotiable)

This repository is AI-governed. Follow these rules strictly.

## Core Principles
- Do NOT introduce new tooling
- Do NOT change the folder structure
- Prefer adding files over modifying existing ones
- If unsure, STOP and ASK

## Folder Ownership
- app/ → Next.js routes, layouts, providers only
- components/ → reusable UI only
- functions/ → backend services only
- prisma/ → database schema, migrations, generated Zod
- lib/ → shared clients and adapters (no business logic)
- workflows/ → system-level Mermaid diagrams
- tests/ → Playwright E2E tests

## Backend Rules
- Prisma may ONLY be imported inside functions/**
- Redis may ONLY be imported inside functions/**
- Business logic lives in functions/<service>/handlers

## API Rules
- Public API contracts use hand-written Zod schemas
- Prisma-generated Zod schemas are INTERNAL ONLY
- OpenAPI is generated from API Zod schemas only

## When Adding a New Service
- Follow functions/users as the reference
- Include handlers/, schemas/, diagrams/
- Export handlers from index.ts
- Add at least one Mermaid diagram

## Emails
- Email templates live in functions/email/templates
- Emails are sent ONLY from functions/email

If a requirement is ambiguous, ask before generating code.