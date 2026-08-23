import { describe, expect, it } from "vitest";

import { formatContext, retrieve } from "@/lib/retrieval";

describe("retrieve", () => {
  it("returns nothing for an empty or stopword-only query", () => {
    expect(retrieve("")).toEqual([]);
    expect(retrieve("what is the")).toEqual([]);
  });

  it("finds the PowerFlex chunk for a query naming the company", () => {
    const hits = retrieve("What did he do at PowerFlex?");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].docId).toBe("powerflex");
  });

  it("ranks results by descending score", () => {
    const hits = retrieve("backend distributed systems experience");
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it("drops chunks far below the top score (relative cutoff)", () => {
    const hits = retrieve("PowerFlex", { minRelativeScore: 0.15 });
    const top = hits[0]?.score ?? 0;
    for (const hit of hits) {
      expect(hit.score).toBeGreaterThanOrEqual(top * 0.15);
    }
  });

  it("respects topK", () => {
    const hits = retrieve("engineer software experience project", { topK: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("is case-insensitive", () => {
    const lower = retrieve("powerflex");
    const upper = retrieve("POWERFLEX");
    expect(lower.map((h) => h.id)).toEqual(upper.map((h) => h.id));
  });
});

describe("formatContext", () => {
  it("labels each chunk with its citation key", () => {
    const hits = retrieve("PowerFlex");
    const formatted = formatContext(hits);
    for (const hit of hits) {
      expect(formatted).toContain(`[${hit.id}]`);
    }
  });

  it("returns an empty string for no chunks", () => {
    expect(formatContext([])).toBe("");
  });
});
