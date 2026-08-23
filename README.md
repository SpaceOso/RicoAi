# ricoai

Miguel Rico's portfolio site. The centerpiece is a chat panel backed by
retrieval-augmented generation: visitor questions are answered by Claude,
grounded strictly in a small hand-authored corpus of Markdown resume and
project content — not the model's general knowledge.

## Getting started

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY; RESEND_API_KEY + CONTACT_TO_EMAIL for the contact form
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build
npm run start    # run a production build
npm run lint     # eslint
npx tsc --noEmit # typecheck (no dedicated test suite)
```

## How it works

1. **`content/*.md`** — one Markdown file per source document (a role, a
   project, skills, education, personal), with YAML frontmatter. Editing the
   corpus is just editing these files — no code changes needed.
2. **`lib/corpus.ts`** loads every file under `content/` and splits each on
   `##` headings into chunks, the retrievable unit. A chunk's id (e.g.
   `powerflex#mentorship`) doubles as its citation key.
3. **`lib/retrieval.ts`** scores chunks against the visitor's question with
   BM25 and returns the top matches. This is a deliberate choice for a corpus
   this size, not a placeholder for embeddings — see the file's header
   comment.
4. **`app/api/ask/route.ts`** retrieves chunks, formats them into a
   `<sources>` block, and streams Claude's response back over SSE
   (`sources`, `thinking`, `text`, `usage`, `error`, `done` events).
5. **`lib/use-ask.ts`** and **`components/ask-panel.tsx`** drive the chat UI —
   streaming turns, retrieval traces, citations, and per-turn cost/latency.

A contact form (`components/contact-modal.tsx` → `app/api/contact/route.ts`)
sends messages via Resend, so the site never displays a raw email address.

See `CLAUDE.md` for more detail on architecture and conventions.

## Deploy on Vercel

The easiest way to deploy this app is to use the
[Vercel Platform](https://vercel.com/new). Set `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, and `CONTACT_TO_EMAIL` as environment variables there.
