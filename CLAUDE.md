# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A Next.js portfolio site for Miguel Rico. Its centerpiece is a chat panel (`AskPanel`) backed by retrieval-augmented generation: visitor questions are answered by Claude, grounded strictly in a small hand-authored corpus of Markdown resume/project content — not by the model's general knowledge.

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build
npm run start    # run a production build
npm run lint     # eslint
npm run test     # vitest (lib/ unit tests + API route handler tests, mocked)
npx tsc --noEmit # typecheck
```

Requires `ANTHROPIC_API_KEY` in `.env.local` (copy from `.env.example`); the `/api/ask` route returns a 503 with a descriptive error if it's unset. Contact-form email delivery additionally needs `RESEND_API_KEY` and `CONTACT_TO_EMAIL`.

## Architecture: the RAG pipeline

This is the flow to understand before touching retrieval, prompting, or content:

1. **`content/*.md`** — one Markdown file per source document (a role, a project, skills, education), with YAML frontmatter matching `DocMeta` in `lib/corpus.ts` (`id`, `title`, `kind`, `org`, `role`, `period`, `order`, ...).
2. **`lib/corpus.ts`** loads every file under `content/` once per server process and splits each on `##` headings into `Chunk`s — the retrievable unit. Chunk `id`s (e.g. `powerflex#mentorship`) double as citation keys.
3. **`lib/retrieval.ts`** (`retrieve(query)`) scores chunks against the query with BM25 and returns the top matches above a relative-score cutoff. This is a deliberate choice, not a placeholder for embeddings — see the file's header comment before changing the ranking approach.
4. **`app/api/ask/route.ts`** is the only place that talks to Claude. It retrieves chunks, formats them into a `<sources>` block (`formatContext`), appends that to the *last* user turn (not the system prompt, to preserve prompt-cache hits on `SYSTEM_PROMPT` across a conversation), and streams the response back as custom SSE events (`lib/sse.ts`: `sources`, `thinking`, `text`, `usage`, `error`, `done`).
5. **`lib/use-ask.ts`** (client hook) drives the fetch/stream loop; **`components/ask-panel.tsx`** renders turns, retrieval traces, citations, and per-turn cost/latency from the `usage` event.

When adding to the corpus: add/edit a `.md` file under `content/`, matching the existing frontmatter shape — no code changes needed for content updates. When changing what the assistant is allowed to say or how it cites sources, that's `SYSTEM_PROMPT` in `app/api/ask/route.ts`.

## Conventions

- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- Styling is Tailwind with a small custom token set defined in `app/globals.css` (`--background`, `--surface`, `--surface-muted`, `--border`, `--foreground`, `--muted`, `--accent`, exposed as `bg-surface`, `text-muted`, etc. via `@theme inline`) — reuse these rather than raw Tailwind colors or new CSS variables.
- Server-only modules that wrap API clients (`lib/anthropic.ts`, `lib/resend.ts`) instantiate a single shared client and expose a `hasXKey()` guard; route handlers check that guard and return a 503 rather than throwing.
- `app/api/*/route.ts` handlers validate request bodies with `zod` schemas before doing anything else.
