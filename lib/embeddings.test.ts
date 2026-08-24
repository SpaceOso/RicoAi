import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => {
  const sql = Object.assign(vi.fn(), {
    unsafe: vi.fn((raw: string) => raw),
  });
  return { sql };
});

import type { Chunk } from "@/lib/corpus";
import { sql } from "@/lib/db";
import { findSimilarChunks, syncChunkEmbeddings } from "@/lib/embeddings";

const mockSql = vi.mocked(sql);

function statementOf(strings: TemplateStringsArray): string {
  const text = strings.join(" ");
  if (text.includes("CREATE EXTENSION")) return "CREATE_EXTENSION";
  if (text.includes("CREATE TABLE")) return "CREATE_TABLE";
  if (text.includes("INSERT")) return "INSERT";
  if (text.includes("DELETE")) return "DELETE";
  if (text.includes("SELECT")) return "SELECT";
  return "UNKNOWN";
}

beforeEach(() => {
  mockSql.mockReset();
  mockSql.mockImplementation(((strings: TemplateStringsArray) => {
    if (statementOf(strings) === "SELECT") {
      return Promise.resolve([{ id: "a", score: 0.9 }]);
    }
    return Promise.resolve([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);
});

const CHUNK_A = { id: "a" } as Chunk;
const CHUNK_B = { id: "b" } as Chunk;

describe("syncChunkEmbeddings", () => {
  it("inserts one row per chunk as a vector literal", async () => {
    await syncChunkEmbeddings([CHUNK_A, CHUNK_B], [[1, 2], [3, 4]]);

    const inserts = mockSql.mock.calls.filter(
      ([strings]) => statementOf(strings as TemplateStringsArray) === "INSERT",
    );
    expect(inserts).toHaveLength(2);
    expect(inserts[0][1]).toBe("a");
    expect(inserts[0][2]).toBe("[1,2]");
  });

  it("deletes rows for chunks no longer present", async () => {
    await syncChunkEmbeddings([CHUNK_A], [[1, 2]]);

    const deleteCall = mockSql.mock.calls.find(
      ([strings]) => statementOf(strings as TemplateStringsArray) === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![1]).toEqual(["a"]);
  });
});

describe("findSimilarChunks", () => {
  it("returns id/score pairs from the nearest-neighbor query", async () => {
    const results = await findSimilarChunks([1, 2, 3], 5);
    expect(results).toEqual([{ id: "a", score: 0.9 }]);
  });

  it("passes the query vector as a bracketed literal and respects the limit", async () => {
    await findSimilarChunks([0.5, 0.25], 7);
    const selectCall = mockSql.mock.calls.find(
      ([strings]) => statementOf(strings as TemplateStringsArray) === "SELECT",
    )!;
    expect(selectCall).toContain("[0.5,0.25]");
    expect(selectCall).toContain(7);
  });
});
