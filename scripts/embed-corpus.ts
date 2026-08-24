import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Re-embeds the entire content/ corpus and syncs it into the
 * `chunk_embeddings` Postgres table. Run this whenever content/*.md changes
 * — retrieval reads only from the stored embeddings, not from the corpus
 * directly, so a stale table means stale (or missing) search results.
 *
 * Usage: npm run embed
 *
 * lib/db.ts reads DATABASE_URL at module load time, so everything that
 * transitively imports it must be dynamically imported here, after
 * dotenv.config() has populated process.env — static imports would be
 * hoisted above the config() call and see an empty environment.
 */
async function main() {
  const { hasVoyageKey, embed } = await import("@/lib/voyage");
  if (!hasVoyageKey()) {
    throw new Error("VOYAGE_API_KEY is not set. Add it to .env.local.");
  }

  const { CHUNKS } = await import("@/lib/corpus");
  const { syncChunkEmbeddings } = await import("@/lib/embeddings");

  console.log(`Embedding ${CHUNKS.length} chunks...`);
  const texts = CHUNKS.map(
    (chunk) => `${chunk.docTitle}\n${chunk.heading ?? ""}\n${chunk.text}`,
  );
  const vectors = await embed(texts, "document");

  await syncChunkEmbeddings(CHUNKS, vectors);
  console.log(`Synced ${CHUNKS.length} chunk embeddings.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
