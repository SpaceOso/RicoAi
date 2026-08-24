import { CHUNKS, type Chunk } from "@/lib/corpus";
import { findSimilarChunks } from "@/lib/embeddings";
import { embed } from "@/lib/voyage";

/**
 * Retrieval over the resume corpus, backed by Voyage AI embeddings stored in
 * Postgres (pgvector). Chunk embeddings are precomputed offline (see
 * `scripts/embed-corpus.ts`) whenever content/*.md changes; this module only
 * embeds the incoming query and does a cosine-similarity lookup against the
 * stored vectors.
 *
 * This replaced an earlier BM25 implementation. BM25 was genuinely strong on
 * exact proper-noun matches ("PowerFlex", "NATS JetStream") but had no way to
 * match paraphrased questions that share no vocabulary with the source text
 * (e.g. "what does he do for fun" vs. content phrased around "hobbies").
 * Embeddings trade a little of that lexical precision for much better recall
 * on natural-language questions, which matters more for a chat interface.
 */

export type ScoredChunk = Chunk & { score: number };

export type RetrieveOptions = {
  /** Maximum chunks to return. */
  topK?: number;
  /** Drop chunks scoring below this fraction of the best score. */
  minRelativeScore?: number;
};

const CHUNKS_BY_ID = new Map(CHUNKS.map((chunk) => [chunk.id, chunk]));

export async function retrieve(
  query: string,
  { topK = 6, minRelativeScore = 0.15 }: RetrieveOptions = {},
): Promise<ScoredChunk[]> {
  if (!query.trim()) return [];

  const [queryVector] = await embed([query], "query");
  const matches = await findSimilarChunks(queryVector, topK * 3);

  const scored = matches
    .map(({ id, score }) => {
      const chunk = CHUNKS_BY_ID.get(id);
      return chunk ? { ...chunk, score } : null;
    })
    .filter((chunk): chunk is ScoredChunk => chunk !== null);

  if (scored.length === 0) return [];

  const cutoff = scored[0].score * minRelativeScore;
  return scored.filter((chunk) => chunk.score >= cutoff).slice(0, topK);
}

/**
 * Formats retrieved chunks for the model. Each block is labelled with the
 * citation key the model is told to cite, so grounding and attribution use the
 * same identifier.
 */
export function formatContext(chunks: ScoredChunk[]): string {
  return chunks
    .map((chunk) => {
      const header = [
        `[${chunk.id}]`,
        chunk.docTitle,
        chunk.heading && `— ${chunk.heading}`,
        chunk.meta.period && `(${chunk.meta.period})`,
      ]
        .filter(Boolean)
        .join(" ");
      return `${header}\n${chunk.text}`;
    })
    .join("\n\n---\n\n");
}
