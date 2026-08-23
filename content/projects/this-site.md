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
- A retrieval layer scores those sections against the visitor's question and
  selects the relevant ones.
- The selected sections are passed to Claude as grounding context, and the model is
  instructed to answer only from them and to cite which sources it used.
- Responses stream to the browser token-by-token over server-sent events.

## Stack

- Next.js (App Router) with React and TypeScript
- Tailwind CSS
- Anthropic Claude via the official TypeScript SDK
- Streaming over SSE with a custom event envelope, cancellation, and per-turn
  token and cost accounting

## Why

- This site was to showcase my abilities to vibe code
- To showcase that I can integrate with LLMs
- To display that I can build a RAG system
- To show that I can deploy a site
