"use client";

import { useCallback, useRef, useState } from "react";

import { readEventStream, type Source, type StreamEvent } from "@/lib/sse";

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
};

export type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  sources?: Source[];
  retrievalMs?: number;
  usage?: Usage;
  error?: string;
};

let counter = 0;
const nextId = () => `t${++counter}`;

export function useAsk(endpoint = "/api/ask") {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patchLast = useCallback((patch: (turn: Turn) => Turn) => {
    setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? patch(t) : t)));
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const ask = useCallback(
    async (input: string) => {
      const question = input.trim();
      if (!question || isStreaming) return;

      const history = [
        ...turns.map(({ role, content }) => ({ role, content })),
        { role: "user" as const, content: question },
      ];

      setTurns((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: question },
        { id: nextId(), role: "assistant", content: "" },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = performance.now();

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.error ?? `Request failed (${response.status})`);
        }

        for await (const event of readEventStream(response.body)) {
          applyEvent(event, patchLast, startedAt);
        }
      } catch (error) {
        patchLast((turn) => ({
          ...turn,
          error: controller.signal.aborted
            ? "Stopped."
            : error instanceof Error
              ? error.message
              : "Request failed.",
        }));
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [endpoint, isStreaming, patchLast, turns],
  );

  const reset = useCallback(() => {
    stop();
    setTurns([]);
    setIsStreaming(false);
  }, [stop]);

  return { turns, isStreaming, ask, stop, reset };
}

function applyEvent(
  event: StreamEvent,
  patchLast: (patch: (turn: Turn) => Turn) => void,
  startedAt: number,
) {
  switch (event.type) {
    case "sources":
      patchLast((t) => ({
        ...t,
        sources: event.sources,
        retrievalMs: event.retrievalMs,
      }));
      break;
    case "thinking":
      patchLast((t) => ({ ...t, thinking: (t.thinking ?? "") + event.text }));
      break;
    case "text":
      patchLast((t) => ({ ...t, content: t.content + event.text }));
      break;
    case "usage":
      patchLast((t) => ({
        ...t,
        usage: {
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          costUsd: event.costUsd,
          latencyMs: Math.round(performance.now() - startedAt),
        },
      }));
      break;
    case "error":
      patchLast((t) => ({ ...t, error: event.message }));
      break;
    case "done":
      break;
  }
}
