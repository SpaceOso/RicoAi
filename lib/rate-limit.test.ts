import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
}));

import { sql } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const mockSql = vi.mocked(sql);

/** Identifies which statement a tagged-template call represents. */
function statementOf(strings: TemplateStringsArray): string {
  const text = strings.join(" ");
  if (text.includes("CREATE TABLE")) return "CREATE_TABLE";
  if (text.includes("CREATE INDEX")) return "CREATE_INDEX";
  if (text.includes("SELECT")) return "SELECT";
  if (text.includes("INSERT")) return "INSERT";
  if (text.includes("DELETE")) return "DELETE";
  return "UNKNOWN";
}

function mockCounts(minuteCount: number, dayCount: number) {
  mockSql.mockImplementation(((strings: TemplateStringsArray) => {
    const kind = statementOf(strings);
    if (kind === "SELECT") {
      return Promise.resolve([
        { minute_count: String(minuteCount), day_count: String(dayCount) },
      ]);
    }
    return Promise.resolve([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);
}

beforeEach(() => {
  mockSql.mockReset();
  vi.spyOn(Math, "random").mockReturnValue(0.5); // skip the 1%-chance cleanup path
});

describe("checkRateLimit", () => {
  it("allows a request under both windows", async () => {
    mockCounts(0, 0);
    const result = await checkRateLimit("1.2.3.4", "ask");
    expect(result.allowed).toBe(true);
  });

  it("blocks once the per-minute limit is reached", async () => {
    mockCounts(5, 5);
    const result = await checkRateLimit("1.2.3.4", "ask");
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("blocks once the per-day limit is reached even under the minute limit", async () => {
    mockCounts(1, 30);
    const result = await checkRateLimit("1.2.3.4", "ask");
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 86_400 });
  });

  it("inserts an event when allowing a request", async () => {
    mockCounts(0, 0);
    await checkRateLimit("1.2.3.4", "ask");
    const insertCall = mockSql.mock.calls.find(
      ([strings]) => statementOf(strings as TemplateStringsArray) === "INSERT",
    );
    expect(insertCall).toBeDefined();
  });

  it("fails open when the database throws", async () => {
    mockSql.mockRejectedValue(new Error("connection refused"));
    const result = await checkRateLimit("1.2.3.4", "ask");
    expect(result.allowed).toBe(true);
  });

  it("keys limits independently per route", async () => {
    mockCounts(5, 5);
    const ask = await checkRateLimit("1.2.3.4", "ask");
    expect(ask.allowed).toBe(false);

    mockCounts(0, 0);
    const contact = await checkRateLimit("1.2.3.4", "contact");
    expect(contact.allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the first entry of x-forwarded-for", () => {
    const request = new Request("http://localhost/api/ask", {
      headers: { "x-forwarded-for": "5.6.7.8, 9.9.9.9" },
    });
    expect(getClientIp(request)).toBe("5.6.7.8");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("http://localhost/api/ask", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(getClientIp(request)).toBe("10.0.0.1");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const request = new Request("http://localhost/api/ask");
    expect(getClientIp(request)).toBe("unknown");
  });
});
