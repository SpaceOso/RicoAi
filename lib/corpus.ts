import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

/**
 * The corpus is the set of Markdown files under `content/`. Each file is one
 * source document (a role, a project, a skills list); each `##` section within
 * it becomes one retrievable chunk.
 *
 * Sections are the right chunk granularity here: they are already topically
 * coherent and authored, so we get clean citations without the arbitrary
 * boundaries that fixed-size character windows produce.
 */

export type DocMeta = {
  id: string;
  title: string;
  kind: "profile" | "experience" | "project" | "skills" | "education" | "personal";
  org?: string;
  role?: string;
  period?: string;
  industry?: string;
  url?: string;
  order: number;
};

export type Chunk = {
  /** Stable citation key, e.g. `powerflex#backend-and-distributed-systems`. */
  id: string;
  docId: string;
  docTitle: string;
  heading?: string;
  text: string;
  meta: DocMeta;
};

export type Doc = DocMeta & {
  /** Full Markdown body, used for the static sections of the page. */
  body: string;
  chunks: Chunk[];
};

const CONTENT_DIR = path.join(process.cwd(), "content");

function listMarkdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Splits a Markdown body on `##` headings. Text before the first heading becomes
 * an untitled lead chunk so intros are never dropped.
 */
function splitIntoChunks(body: string, meta: DocMeta): Chunk[] {
  const sections: { heading?: string; lines: string[] }[] = [
    { heading: undefined, lines: [] },
  ];

  for (const line of body.split("\n")) {
    const match = /^##\s+(.*)$/.exec(line);
    if (match) {
      sections.push({ heading: match[1].trim(), lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  return sections
    .map((section) => ({ ...section, text: section.lines.join("\n").trim() }))
    .filter((section) => section.text.length > 0)
    .map((section) => ({
      id: section.heading
        ? `${meta.id}#${slugify(section.heading)}`
        : meta.id,
      docId: meta.id,
      docTitle: meta.title,
      heading: section.heading,
      text: section.text,
      meta,
    }));
}

function loadDocs(): Doc[] {
  return listMarkdownFiles(CONTENT_DIR)
    .map((file) => {
      const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      const { data, content } = matter(raw);
      const meta = data as DocMeta;
      return {
        ...meta,
        body: content.trim(),
        chunks: splitIntoChunks(content.trim(), meta),
      };
    })
    .sort((a, b) => a.order - b.order);
}

// Loaded once per server process. Content is static at deploy time, so there is
// no reason to hit the filesystem per request.
export const DOCS: Doc[] = loadDocs();
export const CHUNKS: Chunk[] = DOCS.flatMap((doc) => doc.chunks);

export function docsOfKind(kind: DocMeta["kind"]): Doc[] {
  return DOCS.filter((doc) => doc.kind === kind);
}
