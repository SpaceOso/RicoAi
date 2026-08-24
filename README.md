# ricoai

Miguel Rico's portfolio site. The centerpiece is a chat panel backed by
retrieval-augmented generation: visitor questions are answered by Claude,
grounded strictly in a small hand-authored corpus of Markdown resume and
project content — not the model's general knowledge.

## Getting started

```bash
npm install
cp .env.example .env.local   # see .env.example for what each key is for
npm run embed                # embed content/*.md into Postgres (needs DATABASE_URL + VOYAGE_API_KEY)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`/api/ask` needs `ANTHROPIC_API_KEY`, `DATABASE_URL` (Neon Postgres), and
`VOYAGE_API_KEY` — it returns a 503 with a descriptive error if any is unset.
The contact form additionally needs `RESEND_API_KEY` and `CONTACT_TO_EMAIL`.

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build
npm run start    # run a production build
npm run lint     # eslint
npm run test     # vitest (lib/ unit tests + API route handler tests, mocked)
npm run embed    # re-embed content/*.md into Postgres; run after any content change
npx tsc --noEmit # typecheck
```

## How it works

1. **`content/*.md`** — one Markdown file per source document (a role, a
   project, skills, education, personal), with YAML frontmatter. Editing the
   corpus is just editing these files — no code changes needed, but run
   `npm run embed` afterward so retrieval picks up the change.
2. **`lib/corpus.ts`** loads every file under `content/` and splits each on
   `##` headings into chunks, the retrievable unit. A chunk's id (e.g.
   `powerflex#mentorship`) doubles as its citation key.
3. **`lib/retrieval.ts`** embeds the visitor's question with Voyage AI and
   does a cosine-similarity search against chunk embeddings stored in
   Postgres via pgvector (`lib/embeddings.ts`), returning the top matches
   above a relative-score cutoff.
4. **`app/api/ask/route.ts`** retrieves chunks, formats them into a
   `<sources>` block, and streams Claude's response back over SSE
   (`sources`, `thinking`, `text`, `usage`, `error`, `done` events). It's also
   rate-limited per IP (`lib/rate-limit.ts`, Postgres-backed) and logs each
   question/answer/usage to Postgres (`lib/db.ts`) for review.
5. **`lib/use-ask.ts`** and **`components/ask-panel.tsx`** drive the chat UI —
   streaming turns, retrieval traces, citations, and per-turn cost/latency.

A contact form (`components/contact-modal.tsx` → `app/api/contact/route.ts`)
sends messages via Resend, so the site never displays a raw email address; it
shares the same rate limiter as `/api/ask`.

See `CLAUDE.md` for more detail on architecture and conventions.

## Deploy on Vercel

The easiest way to deploy this app is to use the
[Vercel Platform](https://vercel.com/new). Set `ANTHROPIC_API_KEY`,
`DATABASE_URL`, `VOYAGE_API_KEY`, `RESEND_API_KEY`, and `CONTACT_TO_EMAIL` as
environment variables there, and run `npm run embed` (locally, pointed at the
production `DATABASE_URL`) at least once before traffic hits `/api/ask`.
