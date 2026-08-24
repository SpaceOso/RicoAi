import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/voyage", () => ({ embed: vi.fn() }));
vi.mock("@/lib/embeddings", () => ({ findSimilarChunks: vi.fn() }));

import { CHUNKS } from "@/lib/corpus";
import { findSimilarChunks } from "@/lib/embeddings";
import { formatContext, retrieve } from "@/lib/retrieval";
import { embed } from "@/lib/voyage";

const embedMock = vi.mocked(embed);
const findSimilarChunksMock = vi.mocked(findSimilarChunks);

const MENTORSHIP_ID = "powerflex#mentorship";
const OWNERSHIP_ID = "powerflex#product-and-architecture-ownership";

beforeEach(() => {
  vi.clearAllMocks();
  embedMock.mockResolvedValue([[0.1, 0.2, 0.3]]);
  findSimilarChunksMock.mockResolvedValue([]);
});

describe("retrieve", () => {
  it("returns nothing for an empty query without calling the embedding API", async () => {
    expect(await retrieve("")).toEqual([]);
    expect(await retrieve("   ")).toEqual([]);
    expect(embedMock).not.toHaveBeenCalled();
  });

  it("embeds the query with input_type 'query' and searches for topK*3 candidates", async () => {
    await retrieve("what did he do at powerflex", { topK: 6 });
    expect(embedMock).toHaveBeenCalledWith(
      ["what did he do at powerflex"],
      "query",
    );
    expect(findSimilarChunksMock).toHaveBeenCalledWith([0.1, 0.2, 0.3], 18);
  });

  it("hydrates matches into full chunks with their similarity score", async () => {
    findSimilarChunksMock.mockResolvedValue([
      { id: MENTORSHIP_ID, score: 0.82 },
    ]);
    const hits = await retrieve("mentoring juniors");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      id: MENTORSHIP_ID,
      docId: "powerflex",
      score: 0.82,
    });
  });

  it("drops matches whose id no longer exists in the corpus", async () => {
    findSimilarChunksMock.mockResolvedValue([
      { id: "stale#chunk-that-was-deleted", score: 0.9 },
      { id: MENTORSHIP_ID, score: 0.7 },
    ]);
    const hits = await retrieve("anything");
    expect(hits.map((h) => h.id)).toEqual([MENTORSHIP_ID]);
  });

  it("drops matches far below the top score (relative cutoff)", async () => {
    findSimilarChunksMock.mockResolvedValue([
      { id: MENTORSHIP_ID, score: 0.9 },
      { id: OWNERSHIP_ID, score: 0.1 }, // below 0.9 * 0.15 = 0.135
    ]);
    const hits = await retrieve("anything", { minRelativeScore: 0.15 });
    expect(hits.map((h) => h.id)).toEqual([MENTORSHIP_ID]);
  });

  it("respects topK", async () => {
    findSimilarChunksMock.mockResolvedValue(
      CHUNKS.slice(0, 5).map((c, i) => ({ id: c.id, score: 1 - i * 0.01 })),
    );
    const hits = await retrieve("anything", { topK: 2 });
    expect(hits).toHaveLength(2);
  });

  it("returns an empty array when nothing matches", async () => {
    findSimilarChunksMock.mockResolvedValue([]);
    expect(await retrieve("anything")).toEqual([]);
  });
});

describe("formatContext", () => {
  it("labels each chunk with its citation key", () => {
    const chunk = { ...CHUNKS[0], score: 1 };
    expect(formatContext([chunk])).toContain(`[${chunk.id}]`);
  });

  it("returns an empty string for no chunks", () => {
    expect(formatContext([])).toBe("");
  });
});
