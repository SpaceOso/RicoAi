import { CHUNKS, type Chunk } from "@/lib/corpus";

/**
 * Retrieval over the resume corpus.
 *
 * This is deliberately a single narrow interface — `retrieve(query)` — so the
 * scoring function underneath can be swapped without touching the route handler
 * or the prompt. The current implementation is BM25 over the chunk text; the
 * next one will be a dense vector search, and the two will be combined into a
 * hybrid ranker.
 *
 * BM25 first is not a placeholder. On a corpus this size (tens of chunks,
 * heavy on proper nouns like "NATS JetStream", "Stripe Connect", "PowerFlex")
 * exact lexical matching is genuinely strong, and it has no embedding cost,
 * no index to keep in sync, and no cold start.
 */

export type ScoredChunk = Chunk & { score: number };

const K1 = 1.5;
const B = 0.75;

/** Words too common in this corpus to carry signal. */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "did", "do", "does",
  "for", "from", "has", "have", "he", "her", "him", "his", "how", "i", "in",
  "is", "it", "its", "me", "of", "on", "or", "s", "she", "so", "that", "the",
  "their", "them", "they", "this", "to", "was", "were", "what", "when", "where",
  "which", "who", "why", "with", "you", "your",
]);

function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      // Keep `.` and `+` so "node.js" and "c++" survive as single tokens.
      .match(/[a-z0-9][a-z0-9.+#-]*/g) ?? []
  )
    .map((token) => token.replace(/^[.+#-]+|[.+#-]+$/g, ""))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

type IndexEntry = {
  chunk: Chunk;
  termFreq: Map<string, number>;
  length: number;
};

function buildIndex(chunks: Chunk[]) {
  const entries: IndexEntry[] = chunks.map((chunk) => {
    // Index the headings alongside the body: "Backend and distributed systems"
    // is often the most on-topic text in the whole chunk.
    const tokens = tokenize(
      `${chunk.docTitle} ${chunk.heading ?? ""} ${chunk.meta.org ?? ""} ${chunk.meta.role ?? ""} ${chunk.text}`,
    );

    const termFreq = new Map<string, number>();
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }
    return { chunk, termFreq, length: tokens.length };
  });

  const docFreq = new Map<string, number>();
  for (const entry of entries) {
    for (const term of entry.termFreq.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const avgLength =
    entries.reduce((sum, entry) => sum + entry.length, 0) / (entries.length || 1);

  return { entries, docFreq, avgLength, size: entries.length };
}

const INDEX = buildIndex(CHUNKS);

function idf(term: string): number {
  const df = INDEX.docFreq.get(term) ?? 0;
  // Standard BM25 IDF with the +1 smoothing that keeps it non-negative.
  return Math.log(1 + (INDEX.size - df + 0.5) / (df + 0.5));
}

export type RetrieveOptions = {
  /** Maximum chunks to return. */
  topK?: number;
  /** Drop chunks scoring below this fraction of the best score. */
  minRelativeScore?: number;
};

export function retrieve(
  query: string,
  { topK = 6, minRelativeScore = 0.15 }: RetrieveOptions = {},
): ScoredChunk[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const scored: ScoredChunk[] = INDEX.entries.map(
    ({ chunk, termFreq, length }) => {
      let score = 0;
      for (const term of terms) {
        const tf = termFreq.get(term);
        if (!tf) continue;
        const norm = tf * (K1 + 1);
        const denom = tf + K1 * (1 - B + (B * length) / INDEX.avgLength);
        score += idf(term) * (norm / denom);
      }
      return { ...chunk, score };
    },
  );

  const ranked = scored
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return [];

  const cutoff = ranked[0].score * minRelativeScore;
  return ranked.filter((chunk) => chunk.score >= cutoff).slice(0, topK);
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
