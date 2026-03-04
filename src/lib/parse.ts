import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { remark } from "remark";
import { visit } from "unist-util-visit";

import type { DocHeading, ParseResult } from "./docModel";

function getTextFromNode(node: unknown): string {
  if (!node || typeof node !== "object") return "";

  const candidate = node as { value?: unknown; children?: unknown[] };
  if (typeof candidate.value === "string") return candidate.value;
  if (Array.isArray(candidate.children)) {
    return candidate.children.map(getTextFromNode).join("");
  }
  return "";
}

function slugBase(text: string): string {
  const s = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return s || "section";
}

function dedupeSlug(base: string, used: Map<string, number>): string {
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

function applyHeadingIds(html: string, headings: DocHeading[]): string {
  let idx = 0;
  return html.replace(/<(h[1-6])([^>]*)>/g, (match, tag, attrs) => {
    if (idx >= headings.length) return match;
    const id = headings[idx]?.id;
    idx++;
    if (!id) return match;

    const cleanedAttrs = String(attrs).replace(/\sid="[^"]*"/g, "");
    return `<${tag}${cleanedAttrs} id="${id}">`;
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildTocHtml(headings: DocHeading[], maxDepth: number): string {
  const filtered = headings.filter((h) => h.depth <= maxDepth);
  if (filtered.length === 0) return "";

  const items = filtered
    .map((h) => {
      const indent = (h.depth - 1) * 12;
      const safeText = escapeHtml(h.text);
      return `
      <li class="toc-item" style="margin-left:${indent}px">
        <a href="#${h.id}">${safeText}</a>
      </li>`;
    })
    .join("");

  return `
    <section class="toc">
      <h2>Table of Contents</h2>
      <ul class="toc-list">${items}</ul>
    </section>
  `;
}

const prettyCodeOptions = {
  theme: "github-dark",
  keepBackground: false,
  defaultLang: "text",
};

export async function parseMarkdownToHtml(
  markdown: string,
  opts?: { includeToc?: boolean; tocMaxDepth?: number },
): Promise<ParseResult> {
  const headings: DocHeading[] = [];
  const usedSlugs = new Map<string, number>();

  const mdast = remark().use(remarkParse).use(remarkGfm).parse(markdown);

  // Collect headings from MDAST with stable deduped IDs.
  visit(mdast, "heading", (node: unknown) => {
    const headingNode = node as { depth?: number };
    const depth = headingNode.depth as DocHeading["depth"];
    const text = getTextFromNode(node).trim();
    const base = slugBase(text);
    const id = dedupeSlug(base, usedSlugs);

    headings.push({ depth, text, id });
  });

  const schema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      // Allow attrs used by rehype-pretty-code token output.
      code: [
        ...(defaultSchema.attributes?.code || []),
        ["className"],
        ["data-language"],
        ["data-theme"],
        ["style"],
      ],
      pre: [
        ...(defaultSchema.attributes?.pre || []),
        ["className"],
        ["data-language"],
        ["data-theme"],
        ["style"],
      ],
      span: [
        ...(defaultSchema.attributes?.span || []),
        ["className"],
        ["style"],
        ["data-line"],
        ["data-highlighted-line"],
        ["data-highlighted-chars"],
      ],
      figure: [
        ...(defaultSchema.attributes?.figure || []),
        ["className"],
        ["data-rehype-pretty-code-figure"],
      ],
      div: [
        ...(defaultSchema.attributes?.div || []),
        ["className"],
        ["data-rehype-pretty-code-fragment"],
      ],
    },
  };

  const file = await remark()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypePrettyCode, prettyCodeOptions as never)
    .use(rehypeSanitize, schema as never)
    .use(rehypeStringify)
    .process(markdown);

  let html = String(file);
  html = applyHeadingIds(html, headings);

  const includeToc = opts?.includeToc ?? true;
  const tocMaxDepth = opts?.tocMaxDepth ?? 3;
  if (includeToc) {
    const tocHtml = buildTocHtml(headings, tocMaxDepth);
    if (tocHtml) html = tocHtml + html;
  }

  return { html, headings };
}
