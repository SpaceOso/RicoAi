import { AskPanel } from "@/components/ask-panel";

const SUGGESTIONS = [
  "What has Miguel built with React and TypeScript?",
  "What did he do at PowerFlex?",
  "Tell me about Shotsapp.io",
  "What backend technologies has he used?",
  "Is he open to new roles?",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16 sm:py-24">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Miguel Rico</h1>
        <p className="text-muted">
          Full-stack software engineer — 12+ years across clean energy, edtech,
          healthcare, and games. Ask the assistant below about his experience,
          projects, or skills.
        </p>
      </header>

      <AskPanel suggestions={SUGGESTIONS} />

      <footer className="border-t border-border pt-6 text-sm text-muted">
        <a href="mailto:miguelricodev@gmail.com" className="hover:text-foreground">
          miguelricodev@gmail.com
        </a>
      </footer>
    </main>
  );
}
