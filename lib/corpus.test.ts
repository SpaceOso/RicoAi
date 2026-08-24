import { describe, expect, it } from "vitest";

import { CHUNKS, DOCS } from "@/lib/corpus";

describe("corpus loading", () => {
  it("splits documents into per-heading chunks, not one giant chunk", () => {
    // Regression test: content/*.md files use CRLF line endings, and the
    // heading regex in splitIntoChunks previously failed to match "## Foo\r",
    // silently collapsing every doc into a single untitled chunk.
    const powerflexChunks = CHUNKS.filter((c) => c.docId === "powerflex");
    expect(powerflexChunks.length).toBeGreaterThan(1);
    expect(powerflexChunks.map((c) => c.heading)).toContain("Mentorship");
  });

  it("gives every heading chunk a stable, slugified citation id", () => {
    const mentorship = CHUNKS.find((c) => c.id === "powerflex#mentorship");
    expect(mentorship).toBeDefined();
    expect(mentorship?.text.length).toBeGreaterThan(0);
  });

  it("loads at least one document of each kind used by the site", () => {
    const kinds = new Set(DOCS.map((d) => d.kind));
    for (const kind of ["profile", "experience", "project", "skills", "education", "personal"]) {
      expect(kinds.has(kind as never)).toBe(true);
    }
  });
});
