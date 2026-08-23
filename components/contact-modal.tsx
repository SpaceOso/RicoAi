"use client";

import { useRef, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  function open() {
    setStatus("idle");
    setError("");
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("sending");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          message: form.get("message"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to send message.");
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to send message.");
    }
  }

  return (
    <>
      <button
        onClick={open}
        className="text-sm text-muted hover:text-foreground"
      >
        Contact
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setStatus("idle")}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold">Send a message</h2>
            <button
              onClick={close}
              aria-label="Close"
              className="text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {status === "sent" ? (
            <>
              <p className="text-sm text-muted">
                Message sent — Miguel will get back to you soon.
              </p>
              <button
                onClick={close}
                className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                Done
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <input
                name="name"
                required
                placeholder="Your name"
                aria-label="Your name"
                className="rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
              />
              <input
                name="email"
                type="email"
                required
                placeholder="Your email"
                aria-label="Your email"
                className="rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
              />
              <textarea
                name="message"
                required
                rows={4}
                placeholder="Message"
                aria-label="Message"
                className="resize-none rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
              />

              {status === "error" && (
                <p className="text-xs text-accent">{error}</p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              >
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
