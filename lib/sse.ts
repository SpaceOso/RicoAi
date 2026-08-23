/**
 * Minimal server-sent-events helpers shared by the streaming demo routes.
 *
 * We define our own event envelope rather than proxying Anthropic's raw stream
 * so the browser only ever sees the fields it needs, and so each demo can add
 * its own event types (retrieval hits, tool calls) without changing the client
 * transport.
 */

export type Source = {
  id: string;
  title: string;
  heading?: string;
  period?: string;
  score: number;
};

export type StreamEvent =
  | { type: "sources"; sources: Source[]; retrievalMs: number }
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; costUsd: number }
  | { type: "error"; message: string }
  | { type: "done" };

const encoder = new TextEncoder();

export function encodeEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disables proxy buffering (nginx and friends) so deltas arrive as produced.
  "X-Accel-Buffering": "no",
} as const;

/**
 * Reads an SSE body and yields decoded StreamEvents. Handles chunk boundaries
 * that split an event in the middle of its JSON payload.
 */
export async function* readEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      yield JSON.parse(line.slice(5).trim()) as StreamEvent;
    }
  }
}
