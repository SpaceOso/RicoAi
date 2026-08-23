import { describe, expect, it } from "vitest";

import { encodeEvent, readEventStream, type StreamEvent } from "@/lib/sse";

function streamFrom(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function collect(
  stream: ReadableStream<Uint8Array>,
): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const event of readEventStream(stream)) out.push(event);
  return out;
}

describe("encodeEvent / readEventStream", () => {
  it("round-trips a single event", async () => {
    const event: StreamEvent = { type: "text", text: "hello" };
    const events = await collect(streamFrom([encodeEvent(event)]));
    expect(events).toEqual([event]);
  });

  it("round-trips multiple events emitted as separate chunks", async () => {
    const events: StreamEvent[] = [
      { type: "sources", sources: [], retrievalMs: 12 },
      { type: "text", text: "part one " },
      { type: "text", text: "part two" },
      { type: "done" },
    ];
    const chunks = events.map((e) => encodeEvent(e));
    expect(await collect(streamFrom(chunks))).toEqual(events);
  });

  it("reassembles a single event split across multiple chunk writes", async () => {
    const event: StreamEvent = { type: "error", message: "boom" };
    const encoded = encodeEvent(event);
    const mid = Math.floor(encoded.length / 2);
    const chunks = [encoded.slice(0, mid), encoded.slice(mid)];
    expect(await collect(streamFrom(chunks))).toEqual([event]);
  });

  it("ignores blank keep-alive-style noise between frames", async () => {
    const event: StreamEvent = { type: "done" };
    const noise = new TextEncoder().encode("\n\n");
    const events = await collect(streamFrom([noise, encodeEvent(event)]));
    expect(events).toEqual([event]);
  });
});
