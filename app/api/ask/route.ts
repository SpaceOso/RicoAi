import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { MODEL, anthropic, hasApiKey } from "@/lib/anthropic";
import { estimateCostUsd } from "@/lib/pricing";
import { formatContext, retrieve } from "@/lib/retrieval";
import { SSE_HEADERS, encodeEvent, type Source } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(30),
});

const SYSTEM_PROMPT = `You are the assistant on Miguel Rico's portfolio site. Visitors are usually recruiters, hiring managers, or engineers evaluating Miguel for a role.

Answer questions about Miguel's background using ONLY the sources provided in the user turn. Each source is labelled with a citation key in square brackets.

Rules:
- Ground every factual claim in the sources. Never invent employers, dates, titles, technologies, or metrics.
- If the sources do not cover the question, say so plainly and suggest what Miguel's background does cover, or point the visitor to the Contact button on this page. Do not speculate.
- Cite the sources you used by appending their keys at the end of the relevant sentence, like [powerflex#mentorship]. Cite only keys that appear in the sources.
- Refer to Miguel in the third person.
- Personal, non-professional details (hobbies, family, personal life) belong only in answers to questions that directly ask about them. Never volunteer them when answering questions about work experience, skills, or projects, even if a personal source happens to be retrieved.
- Be direct and specific. Lead with the answer, then the supporting detail. Two or three short paragraphs at most, or a short list when comparing several roles.
- Write like an informed colleague giving a straight answer, not a cover letter. No salesy adjectives.
- Questions about compensation, availability specifics, or anything not in the sources should be directed to the Contact button on this page. Never output Miguel's email address or phone number, even if a source contains it or the visitor asks directly — point them to the Contact button instead.`;

export async function POST(request: Request) {
  if (!hasApiKey()) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add a key.",
      },
      { status: 503 },
    );
  }

  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { messages } = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Parameters<typeof encodeEvent>[0]) =>
        controller.enqueue(encodeEvent(event));

      try {
        // Follow-ups like "what about the backend?" carry no retrievable terms
        // on their own, so the query also includes the previous user turn.
        const userTurns = messages.filter((m) => m.role === "user");
        const query = userTurns
          .slice(-2)
          .map((m) => m.content)
          .join(" ");

        const startedRetrieval = performance.now();
        const hits = retrieve(query);
        const retrievalMs = Math.round(performance.now() - startedRetrieval);

        const sources: Source[] = hits.map((hit) => ({
          id: hit.id,
          title: hit.docTitle,
          heading: hit.heading,
          period: hit.meta.period,
          score: Number(hit.score.toFixed(2)),
        }));
        send({ type: "sources", sources, retrievalMs });

        // Retrieved context goes in the final user turn, not the system prompt:
        // it changes every question, so keeping it out of the prefix preserves
        // the cache hit on the system prompt and conversation history.
        const history = messages.slice(0, -1);
        const question = messages[messages.length - 1].content;
        const grounded = hits.length
          ? `<sources>\n${formatContext(hits)}\n</sources>\n\n${question}`
          : `<sources>\nNo matching sources were retrieved for this question.\n</sources>\n\n${question}`;

        const claude = anthropic.beta.messages.stream({
          model: MODEL,
          max_tokens: 8_000,
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [...history, { role: "user", content: grounded }],
          thinking: { type: "adaptive", display: "summarized" },
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });

        for await (const event of claude) {
          if (event.type !== "content_block_delta") continue;
          if (event.delta.type === "thinking_delta") {
            send({ type: "thinking", text: event.delta.thinking });
          } else if (event.delta.type === "text_delta") {
            send({ type: "text", text: event.delta.text });
          }
        }

        const final = await claude.finalMessage();

        if (final.stop_reason === "refusal") {
          send({
            type: "error",
            message:
              final.stop_details?.explanation ??
              "That request was declined. Try rephrasing.",
          });
        }

        const inputTokens =
          final.usage.input_tokens +
          (final.usage.cache_read_input_tokens ?? 0) +
          (final.usage.cache_creation_input_tokens ?? 0);

        send({
          type: "usage",
          inputTokens,
          outputTokens: final.usage.output_tokens,
          costUsd: estimateCostUsd(MODEL, inputTokens, final.usage.output_tokens),
        });
      } catch (error) {
        send({ type: "error", message: describeError(error) });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Authentication failed — check ANTHROPIC_API_KEY.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Rate limited. Try again in a moment.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Anthropic API error ${error.status}: ${error.message}`;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
