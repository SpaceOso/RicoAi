import { type Chunk } from "@/lib/corpus";
import { sql } from "@/lib/db";
import { EMBEDDING_DIMENSION } from "@/lib/voyage";

let schemaReady: Promise<unknown> | null = null;

function ensureSchema() {
  schemaReady ??= sql`CREATE EXTENSION IF NOT EXISTS vector`.then(
    () => sql`
      CREATE TABLE IF NOT EXISTS chunk_embeddings (
        id TEXT PRIMARY KEY,
        embedding ${sql.unsafe(`VECTOR(${EMBEDDING_DIMENSION})`)} NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
  );
  return schemaReady;
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/** Upserts one embedding per chunk, then drops rows for chunks no longer in the corpus. */
export async function syncChunkEmbeddings(
  chunks: Chunk[],
  vectors: number[][],
): Promise<void> {
  await ensureSchema();

  for (let i = 0; i < chunks.length; i++) {
    await sql`
      INSERT INTO chunk_embeddings (id, embedding, updated_at)
      VALUES (${chunks[i].id}, ${toVectorLiteral(vectors[i])}::vector, now())
      ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now()
    `;
  }

  const ids = chunks.map((c) => c.id);
  await sql`DELETE FROM chunk_embeddings WHERE NOT (id = ANY(${ids}))`;
}

export type SimilarityMatch = { id: string; score: number };

/**
 * Returns the `limit` nearest chunks by cosine similarity (1 - cosine
 * distance). The corpus is a few dozen rows, so a plain sequential scan is
 * fine — no ivfflat/hnsw index needed.
 */
export async function findSimilarChunks(
  queryVector: number[],
  limit: number,
): Promise<SimilarityMatch[]> {
  await ensureSchema();
  const literal = toVectorLiteral(queryVector);
  const rows = (await sql`
    SELECT id, 1 - (embedding <=> ${literal}::vector) AS score
    FROM chunk_embeddings
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${limit}
  `) as { id: string; score: number }[];
  return rows.map((row) => ({ id: row.id, score: Number(row.score) }));
}
