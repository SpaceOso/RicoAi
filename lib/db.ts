import { neon } from "@neondatabase/serverless";

/**
 * Single shared query function, mirroring lib/anthropic.ts and lib/resend.ts.
 * Server-only: every import site must be a route handler or server action.
 */
export const sql = neon(process.env.DATABASE_URL ?? "");

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let schemaReady: Promise<unknown> | null = null;

/** Idempotent, cheap enough to run per cold start rather than as a separate migration step. */
function ensureSchema() {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS interactions (
      id BIGSERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT,
      sources JSONB,
      retrieval_ms INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_usd NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  return schemaReady;
}

export interface InteractionRecord {
  question: string;
  answer: string;
  sources: unknown;
  retrievalMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Best-effort logging: a database hiccup must never break the chat response. */
export async function logInteraction(record: InteractionRecord): Promise<void> {
  if (!hasDatabaseUrl()) return;
  try {
    await ensureSchema();
    await sql`
      INSERT INTO interactions
        (question, answer, sources, retrieval_ms, input_tokens, output_tokens, cost_usd)
      VALUES
        (${record.question}, ${record.answer}, ${JSON.stringify(record.sources)},
         ${record.retrievalMs}, ${record.inputTokens}, ${record.outputTokens}, ${record.costUsd})
    `;
  } catch (error) {
    console.error("logInteraction failed:", error);
  }
}
