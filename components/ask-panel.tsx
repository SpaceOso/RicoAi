"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Markdown } from "@/components/markdown";
import { formatUsd } from "@/lib/pricing";
import { useAsk, type Turn } from "@/lib/use-ask";

/** Matches the `[powerflex#mentorship]` citation keys the model emits. */
const CITATION = /\[([a-z0-9][a-z0-9-]*(?:#[a-z0-9-]+)?)\]/g;

export function AskPanel({ suggestions }: { suggestions: string[] }) {
  const { turns, isStreaming, ask, stop, reset } = useAsk();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [turns]);

  function submit(text: string) {
    ask(text);
    setInput("");
  }

  return (
    <section className="flex h-[min(70vh,640px)] flex-col rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {turns.map((turn) => (
              <TurnView key={turn.id} turn={turn} isStreaming={isStreaming} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-5 sm:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Miguel's experience…"
            aria-label="Ask about Miguel's experience"
            className="flex-1 rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            type={isStreaming ? "button" : "submit"}
            onClick={isStreaming ? stop : undefined}
            disabled={!isStreaming && !input.trim()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            {isStreaming ? "Stop" : "Ask"}
          </button>
        </form>

        {turns.length > 0 && (
          <button
            onClick={reset}
            className="self-start text-xs text-muted hover:text-foreground"
          >
            Start over
          </button>
        )}
      </div>
    </section>
  );
}

function TurnView({ turn, isStreaming }: { turn: Turn; isStreaming: boolean }) {
  const { body, cited } = useMemo(() => numberCitations(turn.content), [
    turn.content,
  ]);

  if (turn.role === "user") {
    return <p className="font-medium">{turn.content}</p>;
  }

  const pending = !turn.content && !turn.error;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {turn.sources && (
        <RetrievalTrace
          count={turn.sources.length}
          ms={turn.retrievalMs ?? 0}
          sources={turn.sources.map((s) => ({
            label: s.heading ? `${s.title} — ${s.heading}` : s.title,
            score: s.score,
          }))}
        />
      )}

      {pending && <p className="text-muted">Thinking…</p>}

      {turn.content && <Markdown>{body}</Markdown>}

      {cited.length > 0 && !isStreaming && (
        <ol className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
          {cited.map((key, i) => (
            <li key={key}>
              [{i + 1}] {key}
            </li>
          ))}
        </ol>
      )}

      {turn.error && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          {turn.error}
        </p>
      )}

      {turn.usage && (
        <p className="font-mono text-[11px] text-muted">
          {turn.usage.inputTokens.toLocaleString()} in ·{" "}
          {turn.usage.outputTokens.toLocaleString()} out ·{" "}
          {formatUsd(turn.usage.costUsd)} ·{" "}
          {(turn.usage.latencyMs / 1000).toFixed(1)}s
        </p>
      )}
    </div>
  );
}

function RetrievalTrace({
  count,
  ms,
  sources,
}: {
  count: number;
  ms: number;
  sources: { label: string; score: number }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="font-mono text-muted hover:text-foreground"
      >
        retrieved {count} {count === 1 ? "chunk" : "chunks"} in {ms}ms{" "}
        <span className="opacity-60">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1 border-l border-border pl-3">
          {sources.map((source) => (
            <li key={source.label} className="flex gap-2 text-muted">
              <span className="font-mono opacity-60">
                {source.score.toFixed(2)}
              </span>
              <span>{source.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function numberCitations(text: string): { body: string; cited: string[] } {
  const cited: string[] = [];
  const body = text.replace(CITATION, (match, key: string) => {
    if (!key.includes("#") && !key.includes("-")) return match;
    if (!cited.includes(key)) cited.push(key);
    return `<sup>[${cited.indexOf(key) + 1}]</sup>`;
  });
  return { body, cited };
}
