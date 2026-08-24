import { AskPanel } from "@/components/ask-panel";
import { ContactModal } from "@/components/contact-modal";

const SUGGESTIONS = [
  "What has Miguel built with React and TypeScript?",
  "What did he do at PowerFlex?",
  "Tell me about Shotsapp.io",
  "What backend technologies has he used?",
  "Is he open to new roles?",
];

export default function Home() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col gap-4 px-6 py-6 sm:py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Miguel Rico</h1>
        <p className="text-sm text-muted">
          Full-stack software engineer — 12+ years shipping and owning features
          end-to-end across clean energy, edtech, healthcare, and games.
          He&apos;s led front-end architecture on large-scale platforms and
          mentored engineers along the way, driven by a simple goal: build
          software that actually helps people. Ask the assistant below about his
          experience, projects, or skills.
        </p>
      </header>

      <AskPanel suggestions={SUGGESTIONS} />

      <footer className="flex items-center gap-4 border-t border-border pt-4">
        <ContactModal />
        <a
          href="https://github.com/SpaceOso/RicoAi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted hover:text-foreground"
        >
          GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/miguelrico/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted hover:text-foreground"
        >
          LinkedIn
        </a>
      </footer>
    </main>
  );
}
