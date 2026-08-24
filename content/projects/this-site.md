---
id: this-site
title: This site — a RAG-grounded portfolio
kind: project
org: Independent
role: Full Stack Engineer
start: 2026-08
period: August 2026
order: 11
---

The site you are reading is itself a project. It is a Next.js application whose
assistant answers questions about Miguel's background using retrieval-augmented
generation over his resume and work history.

## How it works

- Content lives as Markdown files in `content/`, split into sections at build time.
- Each section is embedded (Voyage AI) and stored in Postgres via pgvector.
  A visitor's question is embedded the same way and matched against those
  sections by cosine similarity, so paraphrased or loosely worded questions
  still find the right material, not just exact keyword matches.
- The selected sections are passed to Claude as grounding context, and the model is
  instructed to answer only from them and to cite which sources it used.
- Responses stream to the browser token-by-token over server-sent events.
- Every question and answer is logged to a Postgres database, along with the
  retrieved sources, retrieval latency, and per-turn token/cost accounting —
  so visitor questions can be reviewed to see what people actually want to know.
- Both the chat and the contact form are rate-limited per visitor to keep the
  underlying AI and email APIs from being abused.

## Stack

- Next.js (App Router) with React and TypeScript
- Tailwind CSS
- Anthropic Claude via the official TypeScript SDK
- Voyage AI embeddings + pgvector for semantic retrieval
- Streaming over SSE with a custom event envelope, cancellation, and per-turn
  token and cost accounting
- Neon (serverless Postgres) for chunk embeddings, interaction logging, and
  rate limiting

## How it was built

- Built with AI-assisted development, using Claude Code as a pair-programming
  agent for the majority of the implementation — from scaffolding the Next.js
  app and RAG pipeline to adding the interaction-logging database.
- Miguel drove the architecture and product decisions (what to build, what
  tradeoffs to make, what "done" looks like); Claude Code wrote and iterated
  on the code under that direction.
- This mirrors how Miguel works day to day: comfortable directing an AI
  coding agent on real, production-facing work rather than only hand-writing
  every line.

## Why

- This site was to showcase my abilities to vibe code
- To showcase that I can integrate with LLMs
- To display that I can build a RAG system
- To show that I can deploy a site
