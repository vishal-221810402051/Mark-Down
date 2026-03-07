import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { remark } from "remark";
import { visit } from "unist-util-visit";
import type { Blockquote, Paragraph, Root } from "mdast";
import type { Parent } from "unist";
import type { DocIntelligence } from "@/lib/docIntelligence";
import { extractDocIntelligence } from "@/lib/docIntelligence";

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

function promoteCommandsLabelHtml(html: string): string {
  return html.replace(
    /<p>\s*(Commands|Command|CLI|Terminal)\s*:\s*<\/p>/gi,
    (_m, label) => `<p class="mini-heading">${escapeHtml(label)}</p>`,
  );
}

type CalloutKind = "note" | "tip" | "warning" | "important";
type ProcedureKind =
  | "steps"
  | "procedure"
  | "workflow"
  | "checklist"
  | "validation"
  | "run";

function parseCalloutPrefix(
  text: string,
): { kind: CalloutKind; rest: string } | null {
  const m = text.match(/^\s*(Note|Tip|Warning|Important)\s*:\s*(.+)\s*$/i);
  if (!m) return null;
  const kind = m[1].toLowerCase() as CalloutKind;
  return { kind, rest: m[2] };
}

function buildCalloutNode(parsed: { kind: CalloutKind; rest: string }) {
  return {
    type: "paragraph",
    children: [],
    data: {
      hName: "div",
      hProperties: {
        className: ["callout", `callout-${parsed.kind}`],
      },
      hChildren: [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["callout-title"] },
          children: [{ type: "text", value: parsed.kind.toUpperCase() }],
        },
        {
          type: "element",
          tagName: "div",
          properties: { className: ["callout-body"] },
          children: [{ type: "text", value: parsed.rest }],
        },
      ],
    },
  };
}

function mdastCalloutPlugin() {
  return (tree: Root) => {
    visit(
      tree,
      "paragraph",
      (node: Paragraph, index: number | undefined, parent: Parent | undefined) => {
        if (!parent || index === undefined) return;
      if (parent.type === "blockquote") return;
      const first =
        node.children && node.children.length > 0 ? node.children[0] : undefined;
      if (!first || first.type !== "text") return;

      const parsed = parseCalloutPrefix(first.value ?? "");
      if (!parsed) return;

      parent.children[index] = buildCalloutNode(parsed);
      },
    );

    visit(
      tree,
      "blockquote",
      (node: Blockquote, index: number | undefined, parent: Parent | undefined) => {
        const p =
          node.children && node.children.length > 0 ? node.children[0] : undefined;
        if (!parent || index === undefined) return;
        if (!p || p.type !== "paragraph") return;
        const first =
          p.children && p.children.length > 0 ? p.children[0] : undefined;
        if (!first || first.type !== "text") return;

        const parsed = parseCalloutPrefix(first.value ?? "");
        if (!parsed) return;

        parent.children[index] = buildCalloutNode(parsed);
      },
    );
  };
}

function parseProcedureLabel(
  text: string,
): { kind: ProcedureKind; label: string } | null {
  const s = text.trim();
  const m = s.match(/^(Steps|Procedure|Workflow|Checklist|Validation|Run)\s*:\s*$/i);
  if (!m) return null;
  const label = m[1];
  const kind = label.toLowerCase() as ProcedureKind;
  return { kind, label };
}

function stringifyInlineText(children: Array<{ type?: string; value?: string; children?: unknown[] }>): string {
  return (children ?? [])
    .map((c) => {
      if (!c) return "";
      if (c.type === "text") return c.value ?? "";
      if (c.type === "inlineCode") return "`" + (c.value ?? "") + "`";
      if (c.type === "strong") {
        const nested = Array.isArray(c.children)
          ? (c.children as Array<{ value?: string }>)
          : [];
        return nested.map((x) => x.value ?? "").join("");
      }
      return "";
    })
    .join("");
}

function buildProcedureNode(
  parsed: { kind: ProcedureKind; label: string },
  items: string[],
) {
  return {
    type: "paragraph",
    children: [],
    data: {
      hName: "div",
      hProperties: {
        className: ["procedure", `procedure-${parsed.kind}`],
      },
      hChildren: [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["procedure-title"] },
          children: [{ type: "text", value: parsed.label }],
        },
        {
          type: "element",
          tagName: "ol",
          properties: { className: ["procedure-list"] },
          children: items.map((item) => ({
            type: "element",
            tagName: "li",
            properties: {},
            children: [{ type: "text", value: item }],
          })),
        },
      ],
    },
  };
}

function mdastProcedurePlugin() {
  return (tree: Root) => {
    visit(
      tree,
      "paragraph",
      (node: Paragraph, index: number | undefined, parent: Parent | undefined) => {
        if (!parent || index === undefined) return;

        const first =
          node.children && node.children.length > 0 ? node.children[0] : undefined;
        if (!first || first.type !== "text") return;

        const parsed = parseProcedureLabel(first.value ?? "");
        if (!parsed) return;

        const next = (parent.children as Array<{ type?: string; ordered?: boolean; children?: unknown[] }>)[index + 1];
        if (!next || next.type !== "list" || next.ordered !== true) return;

        const items = (next.children ?? [])
          .map((li) => {
            const liNode = li as { children?: Array<{ type?: string; children?: unknown[] }> };
            const p = (liNode.children ?? []).find((x) => x.type === "paragraph");
            if (!p) return "";
            const pNode = p as { children?: Array<{ type?: string; value?: string; children?: unknown[] }> };
            return stringifyInlineText(pNode.children ?? []);
          })
          .map((s) => s.trim())
          .filter(Boolean);

        if (items.length === 0) return;

        (parent.children as unknown[])[index] = buildProcedureNode(parsed, items);
        (parent.children as unknown[]).splice(index + 1, 1);
      },
    );
  };
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

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "div",
    "p",
    "hr",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "pre",
    "code",
    "span",
    "a",
  ],
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div || []), ["className"]],
    p: [...(defaultSchema.attributes?.p || []), ["className"]],
    a: [
      ...(defaultSchema.attributes?.a || []),
      ["href"],
      ["target"],
      ["rel"],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre || []),
      ["className"],
      ["data-language"],
      ["data-theme"],
    ],
    code: [
      ...(defaultSchema.attributes?.code || []),
      ["className"],
      ["data-language"],
      ["data-theme"],
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      ["className"],
      ["style"],
    ],
    th: [...(defaultSchema.attributes?.th || []), ["colspan"], ["rowspan"]],
    td: [...(defaultSchema.attributes?.td || []), ["colspan"], ["rowspan"]],
  },
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

  const file = await remark()
    .use(remarkParse)
    .use(remarkGfm)
    .use(mdastCalloutPlugin)
    .use(mdastProcedurePlugin)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypePrettyCode, prettyCodeOptions as never)
    .use(rehypeSanitize, sanitizeSchema as never)
    .use(rehypeStringify)
    .process(markdown);

  let html = String(file);
  html = applyHeadingIds(html, headings);
  html = promoteCommandsLabelHtml(html);

  const includeToc = opts?.includeToc ?? true;
  const tocMaxDepth = opts?.tocMaxDepth ?? 3;
  if (includeToc) {
    const tocHtml = buildTocHtml(headings, tocMaxDepth);
    if (tocHtml) html = tocHtml + html;
  }

  const intelligence: DocIntelligence = extractDocIntelligence({
    html,
    headings: headings.map((h) => ({
      id: h.id,
      text: h.text,
      level: h.depth,
    })),
    normalizationNotes: [],
  });

  return {
    html,
    headings,
    intelligence,
  };
}
