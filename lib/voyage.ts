/**
 * Minimal client for the Voyage AI embeddings API (Anthropic's recommended
 * embedding partner — Anthropic itself doesn't offer an embeddings endpoint).
 * No SDK dependency needed: it's a single JSON POST.
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3.5-lite";
const OUTPUT_DIMENSION = 1024;

export function hasVoyageKey(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

type VoyageInputType = "document" | "query";

/**
 * Embeds a batch of texts. `inputType` matters: Voyage's models are trained
 * asymmetrically, so tagging corpus chunks as "document" and user questions
 * as "query" measurably improves retrieval quality over leaving it unset.
 */
export async function embed(
  texts: string[],
  inputType: VoyageInputType,
): Promise<number[][]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
      input_type: inputType,
      output_dimension: OUTPUT_DIMENSION,
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

export const EMBEDDING_DIMENSION = OUTPUT_DIMENSION;
