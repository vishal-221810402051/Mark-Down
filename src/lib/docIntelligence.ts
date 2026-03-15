export type DocHeadingInfo = {
  id: string;
  text: string;
  level: number;
};

export type DocCodeBlockInfo = {
  language: string;
  kind: "code" | "command" | "mermaid";
  preview: string;
  lineCount: number;
};

export type DocTableInfo = {
  index: number;
  rows: number;
  cols: number;
  title?: string | null;
};

export type DocDiagramInfo = {
  index: number;
  kind: "mermaid" | "ascii";
  title?: string | null;
  preview: string;
};

export type DocCalloutInfo = {
  kind: "note" | "tip" | "warning" | "important";
  text: string;
};

export type DocProcedureInfo = {
  kind: "steps" | "workflow" | "procedure" | "checklist" | "validation" | "run";
  title: string;
  itemCount: number;
};

export type DocWorkflowInfo = {
  title: string;
  stepCount: number;
  hasMermaid: boolean;
  hasAscii: boolean;
  keywordSignals: number;
};

export type DocHierarchyRole =
  | "title"
  | "subtitle"
  | "section"
  | "subsection"
  | "label"
  | "entity";

export type DocHierarchyNode = {
  id: string;
  text: string;
  role: DocHierarchyRole;
  level: number;
  parentId?: string;
  confidence: number;
};

export type DocTitleBlockInfo = {
  title: string | null;
  subtitleLines: string[];
};

export type DocListInfo = {
  ordered: boolean;
  itemCount: number;
};

export type DocRoadmapInfo = {
  kind: "phase" | "step" | "plan" | "roadmap" | "workflow" | "procedure" | "validation";
  title: string;
  level: number;
};

export type DocSummaryInfo = {
  short: string;
  structural: string;
};

export type DocStats = {
  headings: number;
  codeBlocks: number;
  commandBlocks: number;
  mermaidBlocks: number;
  tables: number;
  diagrams: number;
  callouts: number;
  procedures: number;
  lists: number;
  roadmaps: number;
};

export type DocIntelligence = {
  title: string | null;
  headings: DocHeadingInfo[];
  codeBlocks: DocCodeBlockInfo[];
  tables: DocTableInfo[];
  diagrams: DocDiagramInfo[];
  callouts: DocCalloutInfo[];
  procedures: DocProcedureInfo[];
  lists: DocListInfo[];
  roadmaps: DocRoadmapInfo[];
  workflows?: DocWorkflowInfo[];
  hierarchy?: DocHierarchyNode[];
  titleBlock?: DocTitleBlockInfo;
  summary: DocSummaryInfo;
  stats: DocStats;
  normalizationNotes: string[];
};

function textPreview(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd() + "...";
}

function inferCodeKind(language: string, text: string): "code" | "command" | "mermaid" {
  const lang = language.toLowerCase();
  if (lang === "mermaid") return "mermaid";
  if (
    /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source|cp|mv|rm)\b/m.test(
      text,
    )
  ) {
    return "command";
  }
  if (["bash", "sh", "shell", "zsh", "powershell", "ps1"].includes(lang))
    return "command";
  if (/^(PS [A-Z]:\\|[A-Z]:\\.*>)/m.test(text)) {
    return "command";
  }
  return "code";
}

function classifyRoadmap(
  text: string,
):
  | "phase"
  | "step"
  | "plan"
  | "roadmap"
  | "workflow"
  | "procedure"
  | "validation"
  | null {
  const s = text.trim().toLowerCase();
  if (/^phase\b/.test(s)) return "phase";
  if (/^step\b/.test(s)) return "step";
  if (/^plan\b/.test(s)) return "plan";
  if (/^roadmap\b/.test(s)) return "roadmap";
  if (/^workflow\b/.test(s)) return "workflow";
  if (/^procedure\b/.test(s)) return "procedure";
  if (/^validation\b/.test(s)) return "validation";
  return null;
}

function normalizeLabelText(text: string): string {
  return text.trim().replace(/:$/, "").trim().toLowerCase();
}

const LABEL_PATTERN =
  /^(steps?|workflow|procedure|checklist|validation|deliverables?|acceptance checks?|goals?|requirements?|run|implementation|overview|notes?)$/i;

function isSharedLabelFamily(text: string): boolean {
  return LABEL_PATTERN.test(normalizeLabelText(text));
}

function classifyProcedureLabel(text: string): DocProcedureInfo["kind"] | null {
  const s = normalizeLabelText(text);

  if (s === "workflow") return "workflow";
  if (/^checklist$/.test(s)) return "checklist";
  if (/^deliverables?$/.test(s)) return "checklist";
  if (/^requirements?$/.test(s)) return "checklist";
  if (/^acceptance checks?$/.test(s)) return "validation";
  if (/^validation$/.test(s)) return "validation";
  if (/^steps?$/.test(s)) return "procedure";
  if (/^procedure$/.test(s)) return "procedure";
  if (/^run$/.test(s)) return "run";

  return null;
}

function classifyWorkflowLabel(text: string): boolean {
  const s = text.trim().toLowerCase();

  return (
    s.startsWith("workflow") ||
    s.startsWith("pipeline") ||
    s.startsWith("process") ||
    s.startsWith("data flow") ||
    s.startsWith("architecture flow")
  );
}

function countWorkflowKeywords(text: string): number {
  const keywords = [
    "input",
    "ingest",
    "process",
    "transform",
    "pipeline",
    "workflow",
    "output",
    "prediction",
    "dashboard",
  ];

  const lower = text.toLowerCase();

  return keywords.reduce(
    (count, k) => count + (lower.includes(k) ? 1 : 0),
    0,
  );
}

function looksLikeModuleHeading(text: string): boolean {
  return /^module\s+\d+\b/i.test(text.trim());
}

function looksLikeSectionNumber(text: string): boolean {
  return /^\d+(?:\.\d+)*[.)]?\s+/.test(text.trim());
}

function stripSectionNumber(text: string): string {
  return text.trim().replace(/^\d+(?:\.\d+)*[.)]?\s+/, "").trim();
}

function inferPlainTitleBlock(lines: string[]): DocTitleBlockInfo {
  const top = lines.map((s) => s.trim()).filter(Boolean).slice(0, 4);

  const title = top[0] ?? null;
  const subtitleLines: string[] = [];

  for (let i = 1; i < top.length; i++) {
    const line = top[i];
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line)) break;
    if (/^\d+(?:\.\d+)*[.)]?\s+/.test(line)) break;
    if (/^(inventor|patent|current maturity|trl|author)\b/i.test(line)) break;
    subtitleLines.push(line);
  }

  return { title, subtitleLines };
}

function inferHeadingRole(
  text: string,
  level: number,
): { role: DocHierarchyRole; confidence: number } {
  const t = text.trim();

  if (looksLikeModuleHeading(t)) {
    return { role: "subsection", confidence: 0.92 };
  }

  if (looksLikeSectionNumber(t)) {
    return { role: level <= 2 ? "section" : "subsection", confidence: 0.9 };
  }

  if (/^(executive summary|problem context|core system concept|system architecture overview|embedded intelligence architecture|system safety architecture|current development stage|regulatory development strategy|development capital strategy|strategic vision)$/i.test(t)) {
    return { role: "section", confidence: 0.95 };
  }

  return {
    role: level <= 2 ? "section" : "subsection",
    confidence: 0.75,
  };
}

function parseClassToken(className: string, prefix: string): string | null {
  const parts = className.split(/\s+/).filter(Boolean);
  const hit = parts.find((p) => p.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

export function extractDocIntelligence(params: {
  html: string;
  headings: DocHeadingInfo[];
  normalizationNotes?: string[];
}): DocIntelligence {
  const { html, headings, normalizationNotes = [] } = params;

  const codeBlocks: DocCodeBlockInfo[] = [];
  const tables: DocTableInfo[] = [];
  const diagrams: DocDiagramInfo[] = [];
  const callouts: DocCalloutInfo[] = [];
  const procedures: DocProcedureInfo[] = [];
  const lists: DocListInfo[] = [];
  const roadmaps: DocRoadmapInfo[] = [];
  const workflows: DocWorkflowInfo[] = [];
  const calloutPattern = /^(note|tip|warning|important)\s*:/i;

  const title = headings.find((h) => h.level === 1)?.text ?? headings[0]?.text ?? null;

  // code blocks
  const preRe = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
  let preMatch: RegExpExecArray | null;
  while ((preMatch = preRe.exec(html))) {
    const preHtml = preMatch[1] ?? "";

    const langMatch =
      preHtml.match(/data-language="([^"]+)"/i) ||
      preHtml.match(/class="[^"]*language-([^"\s]+)[^"]*"/i) ||
      preHtml.match(/class="[^"]*lang-([^"\s]+)[^"]*"/i);
    const language = (langMatch?.[1] ?? "text").toLowerCase();

    const text = preHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/span>\s*<span[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
      .trim();

    const kind = inferCodeKind(language, text);
    codeBlocks.push({
      language,
      kind,
      preview: textPreview(text),
      lineCount: text ? text.split("\n").length : 0,
    });

    if (kind === "mermaid") {
      diagrams.push({
        index: diagrams.length + 1,
        kind: "mermaid",
        title: null,
        preview: textPreview(text),
      });
    }

    if (
      kind === "code" &&
      (language === "ascii" || /^[+\-| ]{5,}/m.test(text))
    ) {
      diagrams.push({
        index: diagrams.length + 1,
        kind: "ascii",
        title: null,
        preview: textPreview(text),
      });
    }
  }

  // tables
  const tableRe = /<table\b[\s\S]*?<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html))) {
    const tableHtml = tableMatch[0];
    const rowCount = (tableHtml.match(/<tr\b/gi) ?? []).length;
    const ths = (tableHtml.match(/<th\b/gi) ?? []).length;
    const firstRowTds = (
      tableHtml.match(/<tr\b[\s\S]*?<\/tr>/i)?.[0]?.match(/<t[hd]\b/gi) ?? []
    ).length;

    tables.push({
      index: tables.length + 1,
      rows: rowCount,
      cols: Math.max(ths, firstRowTds),
      title: null,
    });
  }

  // callouts
  const calloutRe = /<div class="([^"]*\bcallout\b[^"]*)">([\s\S]*?)<\/div>/gi;
  let calloutMatch: RegExpExecArray | null;
  while ((calloutMatch = calloutRe.exec(html))) {
    const className = calloutMatch[1] ?? "";
    const inner = calloutMatch[2] ?? "";
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const classKind = parseClassToken(className, "callout-");
    const textKind = text.match(calloutPattern)?.[1]?.toLowerCase() ?? null;
    const kind = classKind ?? textKind;
    if (!kind || !["note", "tip", "warning", "important"].includes(kind)) continue;

    callouts.push({
      kind: kind as DocCalloutInfo["kind"],
      text: textPreview(text, 120),
    });
  }

  // fallback: detect plain paragraph callouts like "Note: ..." / "Tip: ..."
  const paragraphRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let paragraphMatch: RegExpExecArray | null;
  while ((paragraphMatch = paragraphRe.exec(html))) {
    const raw = paragraphMatch[1] ?? "";
    const text = raw
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    const m = text.match(/^(note|tip|warning|important)\s*:\s*(.+)$/i);
    if (!m) continue;

    const kind = m[1].toLowerCase() as "note" | "tip" | "warning" | "important";
    const body = m[2].trim();

    // avoid duplicates if the same text was already captured from .callout blocks
    const exists = callouts.some(
      (c) =>
        c.kind === kind &&
        c.text.toLowerCase() === textPreview(body, 120).toLowerCase(),
    );
    if (exists) continue;

    callouts.push({
      kind,
      text: textPreview(body, 120),
    });
  }

  // procedures
  const procedureRe = /<div class="([^"]*\bprocedure\b[^"]*)">([\s\S]*?)<\/div>/gi;
  let procedureMatch: RegExpExecArray | null;
  while ((procedureMatch = procedureRe.exec(html))) {
    const className = procedureMatch[1] ?? "";
    const inner = procedureMatch[2] ?? "";
    const kind = parseClassToken(className, "procedure-");
    if (
      !kind ||
      !["steps", "workflow", "procedure", "checklist", "validation", "run"].includes(
        kind,
      )
    ) {
      continue;
    }

    const titleMatch = inner.match(/<div class="procedure-title">([\s\S]*?)<\/div>/i);
    const title = (titleMatch?.[1] ?? kind).replace(/<[^>]+>/g, "").trim();
    const itemCount = (inner.match(/<li\b/gi) ?? []).length;

    procedures.push({
      kind: kind as DocProcedureInfo["kind"],
      title,
      itemCount,
    });
  }

  for (const h of headings) {
    const kind = classifyProcedureLabel(h.text);
    if (!kind) continue;

    procedures.push({
      kind,
      title: h.text,
      itemCount: 0,
    });
  }

  // lists
  const olRe = /<ol\b[\s\S]*?<\/ol>/gi;
  const ulRe = /<ul\b[\s\S]*?<\/ul>/gi;

  for (const m of html.matchAll(olRe)) {
    lists.push({
      ordered: true,
      itemCount: (m[0].match(/<li\b/gi) ?? []).length,
    });
  }

  for (const m of html.matchAll(ulRe)) {
    lists.push({
      ordered: false,
      itemCount: (m[0].match(/<li\b/gi) ?? []).length,
    });
  }

  // ascii diagrams
  const asciiRe = /<pre[^>]*class="[^"]*\bascii-diagram\b[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi;
  let asciiMatch: RegExpExecArray | null;
  while ((asciiMatch = asciiRe.exec(html))) {
    const text = (asciiMatch[1] ?? "").replace(/<[^>]+>/g, "").trim();
    diagrams.push({
      index: diagrams.length + 1,
      kind: "ascii",
      title: null,
      preview: textPreview(text),
    });
  }

  // roadmap items from headings
  for (const h of headings) {
    const kind = classifyRoadmap(h.text);
    if (!kind) continue;
    roadmaps.push({
      kind,
      title: h.text,
      level: h.level,
    });
  }

  for (const h of headings) {
    if (!classifyWorkflowLabel(h.text)) continue;

    const headingIndex = html.toLowerCase().indexOf(h.text.toLowerCase());
    const center = headingIndex >= 0 ? headingIndex : 0;
    const context = html.slice(
      Math.max(0, center - 400),
      center + 400,
    );

    const stepCount = (context.match(/^\d+\.\s+/gm) ?? []).length;

    const hasMermaid =
      context.includes("flowchart") ||
      context.includes("graph TD") ||
      context.includes("graph LR");

    const hasAscii =
      context.includes("+---") ||
      context.includes("|") ||
      context.includes("->") ||
      context.includes("-->");

    const keywordSignals = countWorkflowKeywords(context);

    workflows.push({
      title: h.text,
      stepCount,
      hasMermaid,
      hasAscii,
      keywordSignals,
    });
  }

  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h[1-6]|li|pre)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const plainLines = text.replace(/\r\n/g, "\n").split("\n");
  const inferredTitleBlock = inferPlainTitleBlock(plainLines);

  const titleBlock: DocTitleBlockInfo = {
    title: inferredTitleBlock.title ?? title,
    subtitleLines: inferredTitleBlock.subtitleLines,
  };

  const hierarchy: DocHierarchyNode[] = [];
  let hierarchyNodeCounter = 0;
  const makeHierarchyNodeId = (prefix: string) => {
    hierarchyNodeCounter += 1;
    return `${prefix}-${hierarchyNodeCounter}`;
  };

  const titleHeading = headings.find((h) => h.level === 1) ?? headings[0] ?? null;
  const titleNodeText = titleBlock.title?.trim() || titleHeading?.text.trim() || null;

  if (titleNodeText) {
    hierarchy.push({
      id: titleHeading?.id ?? makeHierarchyNodeId("title"),
      text: titleNodeText,
      role: "title",
      level: 1,
      confidence: 0.98,
    });
  }

  for (const line of titleBlock.subtitleLines) {
    const textLine = line.trim();
    if (!textLine) continue;
    hierarchy.push({
      id: makeHierarchyNodeId("subtitle"),
      text: textLine,
      role: "subtitle",
      level: 2,
      confidence: 0.9,
    });
  }

  let lastSectionId: string | undefined;

  for (const h of headings) {
    if (titleHeading && h.id === titleHeading.id) continue;

    const cleanText = stripSectionNumber(h.text);

    // Prevent label-like lines from becoming real sections.
    if (isSharedLabelFamily(cleanText)) {
      const labelNode: DocHierarchyNode = {
        id: h.id,
        text: cleanText,
        role: "label",
        level: h.level,
        confidence: 0.9,
      };

      if (lastSectionId) {
        labelNode.parentId = lastSectionId;
      }

      hierarchy.push(labelNode);
      continue;
    }

    const inferred = inferHeadingRole(cleanText, h.level);

    const node: DocHierarchyNode = {
      id: h.id,
      text: cleanText,
      role: inferred.role,
      level: h.level,
      confidence: inferred.confidence,
    };

    if (node.role === "section") {
      lastSectionId = node.id;
    } else if (node.role === "subsection" && lastSectionId) {
      node.parentId = lastSectionId;
    }

    hierarchy.push(node);
  }

  for (const p of procedures) {
    const existing = hierarchy.some(
      (n) => n.text.toLowerCase() === p.title.trim().toLowerCase(),
    );
    if (existing) continue;

    hierarchy.push({
      id: `proc-${p.kind}-${p.title.toLowerCase().replace(/\s+/g, "-")}`,
      text: p.title.trim(),
      role: "label",
      level: lastSectionId ? 3 : 2,
      parentId: lastSectionId,
      confidence: 0.72,
    });
  }

  const stats: DocStats = {
    headings: headings.length,
    codeBlocks: codeBlocks.filter((b) => b.kind === "code").length,
    commandBlocks: codeBlocks.filter((b) => b.kind === "command").length,
    mermaidBlocks: codeBlocks.filter((b) => b.kind === "mermaid").length,
    tables: tables.length,
    diagrams: diagrams.length,
    callouts: callouts.length,
    procedures: procedures.length,
    lists: lists.length,
    roadmaps: roadmaps.length,
  };

  const summary: DocSummaryInfo = {
    short: `This document contains ${stats.headings} headings, ${stats.codeBlocks + stats.commandBlocks} code/command blocks, ${stats.tables} tables, ${stats.diagrams} diagrams, ${stats.procedures} procedure blocks, and ${stats.callouts} callouts.`,
    structural: title
      ? `Title: "${title}". Main structure includes ${stats.headings} headings, ${stats.tables} tables, ${stats.diagrams} diagrams, and ${stats.procedures} procedural sections.`
      : `This document includes ${stats.headings} headings, ${stats.tables} tables, ${stats.diagrams} diagrams, and ${stats.procedures} procedural sections.`,
  };

  return {
    title,
    headings,
    codeBlocks,
    tables,
    diagrams,
    callouts,
    procedures,
    lists,
    roadmaps,
    workflows,
    hierarchy,
    titleBlock,
    summary,
    stats,
    normalizationNotes,
  };
}
