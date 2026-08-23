---
id: shotsapp
title: Shotsapp.io — creator monetization platform
kind: project
org: Independent
role: Full Stack Engineer
start: 2026-03
end: 2026-03
period: March 2026
url: https://shotsapp.io
order: 10
---

A creator monetization platform Miguel designed, built, and shipped solo — concept
to deployed product with real users. Photographers and artists run public pages
with tips, memberships, posts, and commission listings.

## Stack and architecture

- Architected the full stack independently: React (Vite) + TypeScript + Tailwind
  on the front end; Node.js + Express + PostgreSQL on the back end.
- JWT authentication, Zod request validation, and structured pagination.

## Payments

- Integrated Stripe Checkout and Stripe Connect end-to-end: tips, subscriptions,
  commission checkouts, webhooks, and direct creator payouts.

## Media

- Built an S3-backed media pipeline with EXIF handling, image placeholders, and
  gated content patterns.

## AI features

- Implemented AI features via the OpenAI API: server-side image moderation before
  storage, vision-based captions, and bio generation.
- Used Claude and Cursor throughout development to accelerate delivery without
  compromising code quality or architecture decisions.
