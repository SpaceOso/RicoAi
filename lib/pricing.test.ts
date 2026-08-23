import { describe, expect, it } from "vitest";

import { estimateCostUsd, formatUsd } from "@/lib/pricing";

describe("estimateCostUsd", () => {
  it("computes cost from per-million-token prices", () => {
    // claude-sonnet-5: $3/M input, $15/M output
    const cost = estimateCostUsd("claude-sonnet-5", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18, 10);
  });

  it("scales linearly with token count", () => {
    const cost = estimateCostUsd("claude-opus-5", 500_000, 0);
    expect(cost).toBeCloseTo(2.5, 10);
  });

  it("returns 0 for an unknown model rather than throwing", () => {
    expect(estimateCostUsd("made-up-model", 1_000_000, 1_000_000)).toBe(0);
  });

  it("returns 0 for zero tokens", () => {
    expect(estimateCostUsd("claude-haiku-4-5", 0, 0)).toBe(0);
  });
});

describe("formatUsd", () => {
  it("formats exactly zero as a bare dollar sign", () => {
    expect(formatUsd(0)).toBe("$0");
  });

  it("uses 4 decimal places for sub-cent amounts", () => {
    expect(formatUsd(0.0034)).toBe("$0.0034");
  });

  it("uses 2 decimal places at or above a cent", () => {
    expect(formatUsd(0.01)).toBe("$0.01");
    expect(formatUsd(1.5)).toBe("$1.50");
  });
});
