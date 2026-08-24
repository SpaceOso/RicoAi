import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { embed, hasVoyageKey } from "@/lib/voyage";

const originalKey = process.env.VOYAGE_API_KEY;
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.VOYAGE_API_KEY = "test-key";
});

afterEach(() => {
  process.env.VOYAGE_API_KEY = originalKey;
  global.fetch = originalFetch;
});

describe("hasVoyageKey", () => {
  it("reflects whether VOYAGE_API_KEY is set", () => {
    expect(hasVoyageKey()).toBe(true);
    delete process.env.VOYAGE_API_KEY;
    expect(hasVoyageKey()).toBe(false);
  });
});

describe("embed", () => {
  it("posts the texts, model, input_type, and output_dimension", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await embed(["hello"], "query");

    expect(result).toEqual([[0.1, 0.2]]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.voyageai.com/v1/embeddings");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      input: ["hello"],
      model: "voyage-3.5-lite",
      input_type: "query",
      output_dimension: 1024,
    });
  });

  it("throws with the response body when the API errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid api key",
    }) as unknown as typeof fetch;

    await expect(embed(["hello"], "document")).rejects.toThrow(
      /401.*invalid api key/,
    );
  });
});
