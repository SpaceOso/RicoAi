import { beforeEach, describe, expect, it, vi } from "vitest";

import { readEventStream, type StreamEvent } from "@/lib/sse";

const hasApiKeyMock = vi.fn();
const streamMock = vi.fn();
const checkRateLimitMock = vi.fn();
const retrieveMock = vi.fn();
const logInteractionMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  MODEL: "claude-sonnet-5",
  hasApiKey: hasApiKeyMock,
  anthropic: { beta: { messages: { stream: streamMock } } },
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "1.2.3.4",
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/retrieval", () => ({
  retrieve: retrieveMock,
  formatContext: (hits: unknown[]) => `formatted:${hits.length}`,
}));

vi.mock("@/lib/db", () => ({
  logInteraction: logInteractionMock,
}));

const SAMPLE_CHUNK = {
  id: "powerflex#mentorship",
  docId: "powerflex",
  docTitle: "PowerFlex",
  heading: "Mentorship",
  text: "Mentored junior engineers.",
  meta: { period: "2021–2023" },
  score: 4.2,
};

function fakeStream(deltas: string[], final: Record<string, unknown>) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const text of deltas) {
        yield { type: "content_block_delta", delta: { type: "text_delta", text } };
      }
    },
    finalMessage: async () => final,
  };
}

function defaultFinalMessage(text = "Hello world") {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ask", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

async function collectEvents(res: Response): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of readEventStream(res.body!)) events.push(event);
  return events;
}

let POST: typeof import("./route").POST;

beforeEach(async () => {
  vi.clearAllMocks();
  hasApiKeyMock.mockReturnValue(true);
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  retrieveMock.mockReturnValue([SAMPLE_CHUNK]);
  streamMock.mockReturnValue(
    fakeStream(["Hello ", "world"], defaultFinalMessage()),
  );
  logInteractionMock.mockResolvedValue(undefined);
  ({ POST } = await import("./route"));
});

describe("POST /api/ask", () => {
  it("rejects an invalid body", async () => {
    const res = await post({ messages: [] });
    expect(res.status).toBe(400);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("returns 429 and never calls Claude when rate limited", async () => {
    checkRateLimitMock.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });
    const res = await post({ messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("streams sources, text, and usage events for a normal question", async () => {
    const res = await post({
      messages: [{ role: "user", content: "What did he do at PowerFlex?" }],
    });
    expect(res.status).toBe(200);

    const events = await collectEvents(res);
    const sourcesEvent = events.find((e) => e.type === "sources");
    const textEvents = events.filter((e) => e.type === "text");
    const usageEvent = events.find((e) => e.type === "usage");

    expect(sourcesEvent).toMatchObject({
      type: "sources",
      sources: [{ id: "powerflex#mentorship" }],
    });
    expect(textEvents.map((e) => (e as { text: string }).text).join("")).toBe(
      "Hello world",
    );
    expect(usageEvent).toMatchObject({
      type: "usage",
      inputTokens: 100,
      outputTokens: 20,
    });
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("logs the interaction with the final answer and usage", async () => {
    await collectEvents(
      await post({
        messages: [{ role: "user", content: "What did he do at PowerFlex?" }],
      }),
    );

    expect(logInteractionMock).toHaveBeenCalledTimes(1);
    expect(logInteractionMock.mock.calls[0][0]).toMatchObject({
      question: "What did he do at PowerFlex?",
      answer: "Hello world",
      inputTokens: 100,
      outputTokens: 20,
    });
  });

  it("still responds when retrieval finds no sources", async () => {
    retrieveMock.mockReturnValue([]);
    const res = await post({
      messages: [{ role: "user", content: "does not matter" }],
    });
    const events = await collectEvents(res);
    expect(events.find((e) => e.type === "sources")).toMatchObject({
      sources: [],
    });
  });

  it("emits an error event when Claude refuses", async () => {
    streamMock.mockReturnValue(
      fakeStream([], {
        stop_reason: "refusal",
        stop_details: { explanation: "Can't help with that." },
        content: [],
        usage: {
          input_tokens: 10,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }),
    );
    const res = await post({
      messages: [{ role: "user", content: "anything" }],
    });
    const events = await collectEvents(res);
    expect(events.find((e) => e.type === "error")).toMatchObject({
      message: "Can't help with that.",
    });
  });
});

describe("POST /api/ask when unconfigured", () => {
  it("returns 503 without checking rate limits or calling Claude", async () => {
    vi.resetModules();
    vi.doMock("@/lib/anthropic", () => ({
      MODEL: "claude-sonnet-5",
      hasApiKey: () => false,
      anthropic: { beta: { messages: { stream: streamMock } } },
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      getClientIp: () => "1.2.3.4",
      checkRateLimit: checkRateLimitMock,
    }));

    const { POST: unconfiguredPost } = await import("./route");
    const res = await unconfiguredPost(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    );

    expect(res.status).toBe(503);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(streamMock).not.toHaveBeenCalled();
  });
});
