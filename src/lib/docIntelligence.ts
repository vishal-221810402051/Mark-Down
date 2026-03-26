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

export type DocStructuralGroup = {
  id: string;
  kind:
    | "prose_section"
    | "entity_group"
    | "procedure_block"
    | "phase_block"
    | "table_section"
    | "list_section";
  title?: string;
  parentId?: string;
  childNodeIds?: string[];
  startLine?: number;
  endLine?: number;
  confidence?: number;
  signals?: string[];
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
  groups?: DocStructuralGroup[];
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

const ENTITY_INTRO_PATTERN =
  /(includes?|integrates?|components?|modules?|engines?|layers?|categories include|monitor|contains?|subsystems?)/i;

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

function looksLikeEntityLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 60) return false;
  if (/[.?!]$/.test(t)) return false;
  if (/^\d+[\).\s]/.test(t)) return false;
  if (LABEL_PATTERN.test(t.replace(/:$/, ""))) return false;
  if (/\b(is|are|was|were|should|must|can|will|uses|provides)\b/i.test(t)) return false;
  if (t.split(/\s+/).filter(Boolean).length > 6) return false;

  return /^[A-Za-z0-9][A-Za-z0-9\s\-\/(),+]+$/.test(t);
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
  const groups: DocStructuralGroup[] = [];
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

  let lastEntityParentId: string | undefined = lastSectionId;
  let previousNonBlank = "";

  for (const rawLine of plainLines) {
    const currentLine = rawLine.trim();
    if (!currentLine) continue;

    const matchedNode = hierarchy.find(
      (n) => n.text.trim().toLowerCase() === currentLine.toLowerCase(),
    );
    if (matchedNode) {
      if (
        matchedNode.role === "section" ||
        matchedNode.role === "subsection" ||
        matchedNode.role === "label"
      ) {
        lastEntityParentId = matchedNode.id;
      }
      previousNonBlank = currentLine;
      continue;
    }

    const intro = previousNonBlank.replace(/:$/, "").trim();
    if (ENTITY_INTRO_PATTERN.test(intro) && looksLikeEntityLine(currentLine)) {
      const duplicate = hierarchy.some(
        (n) =>
          n.role === "entity" &&
          n.text.trim().toLowerCase() === currentLine.toLowerCase() &&
          n.parentId === lastEntityParentId,
      );

      if (!duplicate) {
        const parentNode = lastEntityParentId
          ? hierarchy.find((n) => n.id === lastEntityParentId)
          : undefined;
        hierarchy.push({
          id: makeHierarchyNodeId("entity"),
          text: currentLine,
          role: "entity",
          level: parentNode ? Math.min(parentNode.level + 1, 6) : 3,
          parentId: lastEntityParentId,
          confidence: 0.76,
        });
      }
    }

    previousNonBlank = currentLine;
  }

  // Structural grouping (Phase 20C-B2): additive groups only.
  const normalizedHeadingText = new Set<string>();
  for (const h of headings) {
    const raw = h.text.trim().toLowerCase();
    const stripped = stripSectionNumber(h.text).toLowerCase();
    if (raw) normalizedHeadingText.add(raw);
    if (stripped) normalizedHeadingText.add(stripped);
  }

  const lineToHierarchy = new Map<string, DocHierarchyNode[]>();
  const idToHierarchy = new Map<string, DocHierarchyNode>();
  for (const node of hierarchy) {
    const key = node.text.trim().toLowerCase();
    idToHierarchy.set(node.id, node);
    if (!key) continue;
    const arr = lineToHierarchy.get(key) ?? [];
    arr.push(node);
    lineToHierarchy.set(key, arr);
  }

  const titleNode = hierarchy.find((n) => n.role === "title");
  const rootParentId = titleNode?.id;
  const sectionNodeCount = hierarchy.filter((n) => n.role === "section").length;
  const documentStructureWeak = headings.length < 3 && sectionNodeCount < 2;
  const MAX_GROUP_SPAN = 10;
  const tocLineOffset = (() => {
    const tocMatch =
      html.match(/^\s*<section class="toc"[\s\S]*?<\/section>/i) ??
      html.match(/^\s*<nav class="toc"[\s\S]*?<\/nav>/i);
    if (!tocMatch) return 0;
    const tocText = tocMatch[0]
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
    if (!tocText) return 0;
    return tocText.replace(/\r\n/g, "\n").split("\n").length;
  })();

  function normalizeGroupLine(value: string): string {
    return value.trim().replace(/\s+/g, " ");
  }

  function nextNonBlankPlainLine(linesInput: string[], start: number): string {
    for (let i = start; i < linesInput.length; i++) {
      const s = normalizeGroupLine(linesInput[i] ?? "");
      if (s) return s;
    }
    return "";
  }

  function looksLikeTableBoundary(line: string, nextLine = ""): boolean {
    const s = normalizeGroupLine(line);
    const n = normalizeGroupLine(nextLine);
    if (!s) return false;

    if (/^<table\b/i.test(s) || /^<\/table>/i.test(s)) return true;
    if (/^\|.*\|$/.test(s)) return true;
    if (/^[\-\s:|]{3,}$/.test(s) && s.includes("|")) return true;

    // table-start style rows such as "A | B" or "A | B | C"
    if (s.includes("|")) {
      const cols = s.split("|").map((x) => x.trim()).filter(Boolean);
      if (cols.length >= 2) return true;
      if (/^[\-\s:|]{3,}$/.test(n) && n.includes("|")) return true;
    }

    return false;
  }

  function looksLikeCodeBoundary(line: string): boolean {
    const s = normalizeGroupLine(line);
    if (!s) return false;

    if (/^`{3,}|^~{3,}/.test(s)) return true;
    if (/^(FROM|RUN|CMD|ENTRYPOINT|COPY|ADD|ARG|ENV|EXPOSE|WORKDIR)\b/i.test(s)) {
      return true;
    }
    if (
      /^(function\b|const\b|let\b|var\b|def\b|class\b|import\b|export\b|if\s*\(|for\s*\(|while\s*\()/i.test(
        s,
      )
    ) {
      return true;
    }
    if (
      /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source|cp|mv|rm|sudo)\b/i.test(
        s,
      )
    ) {
      return true;
    }
    if (/=>|[{}`;$]|^[<>].*/.test(s)) return true;

    return false;
  }

  function looksLikeDiagramBoundary(line: string): boolean {
    const s = normalizeGroupLine(line);
    if (!s) return false;

    if (
      /^(graph\s+(TD|LR)|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt)\b/i.test(
        s,
      )
    ) {
      return true;
    }
    if (/^[\u2500-\u257f]+$/.test(s)) return true;
    if (/^[\u2190-\u21ff]|->|-->|\+---|^\|/.test(s)) return true;

    return false;
  }

  function isHardBoundaryLine(line: string, nextLine = ""): boolean {
    const s = normalizeGroupLine(line);
    if (!s) return true;
    const lower = s.toLowerCase();

    if (normalizedHeadingText.has(lower)) return true;
    if (/^#{1,6}\s+/.test(s)) return true;
    if (looksLikeTableBoundary(s, nextLine)) return true;
    if (looksLikeCodeBoundary(s)) return true;
    if (looksLikeDiagramBoundary(s)) return true;

    return false;
  }

  function isGroupingBoundaryLine(line: string): boolean {
    const s = normalizeGroupLine(line);
    if (!s) return true;
    const lower = s.toLowerCase();

    if (isHardBoundaryLine(s)) return true;
    if (/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|WITH|PRAGMA)\b/i.test(s)) return true;

    const roleNodes = lineToHierarchy.get(lower) ?? [];
    if (
      roleNodes.some(
        (n) =>
          n.role === "title" ||
          n.role === "section" ||
          n.role === "subsection" ||
          n.role === "label",
      )
    ) {
      return true;
    }

    return false;
  }

  function looksCodeLikeProseTitle(line: string): boolean {
    const s = normalizeGroupLine(line);
    if (!s) return false;

    if (/^(FROM|RUN|CMD|ENTRYPOINT|COPY|ADD|ARG|ENV|EXPOSE|WORKDIR)\b/i.test(s)) {
      return true;
    }
    if (
      /\b(if\s*\(|function\s*\(|while\s*\(|for\s*\(|SELECT\b|INSERT\b|UPDATE\b|DELETE\b)\b/i.test(
        s,
      )
    ) {
      return true;
    }
    if (
      /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source)\b/i.test(
        s,
      )
    ) {
      return true;
    }

    const symbolCount = (s.match(/[{}[\]`$=<>;]/g) ?? []).length;
    const parenCount = (s.match(/[()]/g) ?? []).length;
    if (symbolCount >= 2) return true;
    if (parenCount >= 2) return true;

    return false;
  }

  function isLikelyParagraphFollow(line: string): boolean {
    const s = normalizeGroupLine(line);
    if (!s) return false;
    if (isGroupingBoundaryLine(s)) return false;
    const words = s.split(/\s+/).filter(Boolean);

    return (
      words.length >= 8 ||
      /[.;,)]$/.test(s) ||
      /\b(is|are|was|were|should|must|can|will|includes?|integrates?|contains?|provides?)\b/i.test(
        s,
      )
    );
  }

  function looksLikeProseSectionTitle(line: string): boolean {
    const s = normalizeGroupLine(line);
    if (!s) return false;
    if (s.length < 4 || s.length > 60) return false;
    if (/[.?!:]$/.test(s)) return false;
    if (/^\d+(?:\.\d+)*[.)]?\s+/.test(s)) return false;
    if (normalizedHeadingText.has(s.toLowerCase())) return false;
    if (isSharedLabelFamily(s) || classifyProcedureLabel(s) || classifyWorkflowLabel(s)) {
      return false;
    }
    if (looksCodeLikeProseTitle(s)) return false;
    if (looksLikeEntityLine(s)) return false;

    const words = s.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 7) return false;
    if (!/^[A-Z]/.test(s)) return false;
    if (!/[A-Za-z]/.test(s)) return false;

    const titleLike =
      words.filter((w) => /^[A-Z][A-Za-z0-9/&()+-]*$/.test(w) || /^[-/]+$/.test(w)).length >=
      Math.max(1, words.length - 1);
    return titleLike;
  }

  function looksLikeListSectionLabel(line: string): boolean {
    const s = normalizeGroupLine(line);
    if (!s.endsWith(":")) return false;
    const label = s.replace(/:$/, "").trim();
    if (!label) return false;
    if (label.length > 60) return false;
    if (!/^[A-Z]/.test(label)) return false;
    if (normalizedHeadingText.has(label.toLowerCase())) return false;
    if (/^\d+(?:\.\d+)*[.)]?\s+/.test(label)) return false;
    return true;
  }

  function escapeForRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hasImmediateHtmlTableAfterLabel(labelText: string): boolean {
    const t = labelText.trim();
    if (!t) return false;

    const escaped = escapeForRegex(t);
    const directPattern = new RegExp(
      `${escaped}\\s*:?\\s*</(?:p|li|h[1-6])>\\s*<table\\b`,
      "i",
    );
    if (directPattern.test(html)) return true;

    const lower = html.toLowerCase();
    const token = t.toLowerCase();
    let idx = lower.indexOf(token);
    while (idx !== -1) {
      const tail = lower.slice(idx + token.length, idx + token.length + 500);
      if (/^[^<]{0,30}<\/(?:p|li|h[1-6])>\s*<table\b/i.test(tail)) {
        return true;
      }
      idx = lower.indexOf(token, idx + token.length);
    }

    return false;
  }

  function hasNearbyHtmlTableAfterLabel(labelText: string): boolean {
    const t = labelText.trim();
    if (!t) return false;

    const lower = html.toLowerCase();
    const token = t.toLowerCase();
    let idx = lower.indexOf(token);
    while (idx !== -1) {
      const tail = lower.slice(idx + token.length, idx + token.length + 1200);
      if (tail.includes("<table")) return true;
      idx = lower.indexOf(token, idx + token.length);
    }
    return false;
  }

  function stripListMarker(line: string): string {
    return line
      .replace(/^[-*+]\s+\[[ xX]\]\s+/, "")
      .replace(/^[•●▪◦‣]\s+/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+(?:[.)])\s+/, "")
      .trim();
  }

  function isBulletListLine(line: string): boolean {
    const s = normalizeGroupLine(line);
    return (
      /^[-*+]\s+\S+/.test(s) ||
      /^[-*+]\s+\[[ xX]\]\s+\S+/.test(s) ||
      /^[•●▪◦‣]\s+\S+/.test(s)
    );
  }

  function isNumberedListLine(line: string): boolean {
    const s = normalizeGroupLine(line);
    return /^\d+(?:[.)])\s+\S+/.test(s);
  }

  function isLikelyShortListLine(line: string): boolean {
    const original = normalizeGroupLine(line);
    const s = stripListMarker(original);
    if (!s) return false;
    if (s.length >= 80) return false;
    if (/[.]$/.test(s)) return false;
    if (/^#{1,6}\s+/.test(original)) return false;
    if (/^\|.*\|$/.test(original)) return false;
    if (looksLikeTableBoundary(original)) return false;
    if (looksLikeCodeBoundary(original)) return false;
    if (looksLikeDiagramBoundary(original)) return false;
    if (isHardBoundaryLine(original)) return false;
    if (/^(and|or|but)\b/i.test(s)) return false;
    if (
      /\b(this|that|these|those|is|are|was|were|should|must|can|will|could|would|may|might|contains?|includes?|provides?)\b/i.test(
        s,
      )
    ) {
      return false;
    }

    const words = s.split(/\s+/).filter(Boolean);
    return words.length >= 1 && words.length <= 8;
  }

  function isLikelyParagraphBlockLine(line: string): boolean {
    const s = normalizeGroupLine(line);
    if (!s) return false;
    if (isHardBoundaryLine(s)) return false;
    if (looksLikeListSectionLabel(s)) return false;
    if (isBulletListLine(s) || isNumberedListLine(s)) return false;
    if (s.length < 20) return false;
    return isLikelyParagraphFollow(s);
  }

  function getRoleNodesForLine(line: string): DocHierarchyNode[] {
    return lineToHierarchy.get(normalizeGroupLine(line).toLowerCase()) ?? [];
  }

  function hasNearbyStructureAnchor(
    lineIndex: number,
    radius = 3,
    includeTitle = false,
  ): boolean {
    const start = Math.max(0, lineIndex - radius);
    const end = Math.min(plainLines.length - 1, lineIndex + radius);
    for (let i = start; i <= end; i++) {
      const text = normalizeGroupLine(plainLines[i] ?? "");
      if (!text) continue;
      const nodes = getRoleNodesForLine(text);
      if (
        nodes.some(
          (n) =>
            n.role === "section" ||
            n.role === "subsection" ||
            (includeTitle && n.role === "title"),
        )
      ) {
        return true;
      }
    }
    return false;
  }

  function collectEntityChildIds(line: string): string[] {
    const full = normalizeGroupLine(line).toLowerCase();
    const stripped = stripListMarker(line).toLowerCase();
    const entityIds = new Set<string>();

    for (const key of [full, stripped]) {
      if (!key) continue;
      const nodes = lineToHierarchy.get(key) ?? [];
      for (const n of nodes) {
        if (n.role === "entity") {
          entityIds.add(n.id);
        }
      }
    }

    return Array.from(entityIds);
  }

  type AttachedBlockKind =
    | "none"
    | "short_line_run"
    | "bullet_list"
    | "numbered_list"
    | "table"
    | "paragraph";

  type AttachedBlockAnalysis = {
    kind: AttachedBlockKind;
    firstLine: number;
    lastLine: number;
    itemCount: number;
    childNodeIds: string[];
    exceededSpan: boolean;
    signals: string[];
  };

  function analyzeAttachedBlock(labelIndex: number): AttachedBlockAnalysis {
    let j = labelIndex + 1;
    let skippedBlank = 0;

    while (j < plainLines.length) {
      const s = normalizeGroupLine(plainLines[j] ?? "");
      if (s) break;
      skippedBlank++;
      if (skippedBlank > 1) {
        return {
          kind: "none",
          firstLine: -1,
          lastLine: -1,
          itemCount: 0,
          childNodeIds: [],
          exceededSpan: false,
          signals: [],
        };
      }
      j++;
    }

    if (j >= plainLines.length) {
      return {
        kind: "none",
        firstLine: -1,
        lastLine: -1,
        itemCount: 0,
        childNodeIds: [],
        exceededSpan: false,
        signals: [],
      };
    }

    const first = normalizeGroupLine(plainLines[j] ?? "");
    const next = normalizeGroupLine(plainLines[j + 1] ?? "");

    const firstIsTable = looksLikeTableBoundary(first, next);
    if (firstIsTable) {
      // Table is a hard grouping boundary: keep only label-level association.
      return {
        kind: "table",
        firstLine: labelIndex + 1,
        lastLine: labelIndex + 1,
        itemCount: 1,
        childNodeIds: [],
        exceededSpan: false,
        signals: ["attached_table_follow"],
      };
    }
    if (isHardBoundaryLine(first, next)) {
      return {
        kind: "none",
        firstLine: -1,
        lastLine: -1,
        itemCount: 0,
        childNodeIds: [],
        exceededSpan: false,
        signals: [],
      };
    }

    let kind: AttachedBlockKind = "none";
    if (firstIsTable) {
      kind = "table";
    } else if (isBulletListLine(first)) {
      kind = "bullet_list";
    } else if (isNumberedListLine(first)) {
      kind = "numbered_list";
    } else if (isLikelyShortListLine(first)) {
      kind = "short_line_run";
    } else if (isLikelyParagraphBlockLine(first)) {
      kind = "paragraph";
    }

    if (kind === "none") {
      return {
        kind,
        firstLine: -1,
        lastLine: -1,
        itemCount: 0,
        childNodeIds: [],
        exceededSpan: false,
        signals: [],
      };
    }

    const childNodeIds = new Set<string>();
    let firstAccepted = -1;
    let lastAccepted = -1;
    let itemCount = 0;
    let exceededSpan = false;

    while (j < plainLines.length) {
      const candidate = normalizeGroupLine(plainLines[j] ?? "");
      const nextCandidate = normalizeGroupLine(plainLines[j + 1] ?? "");

      if (!candidate) {
        if (kind === "paragraph") break;
        const afterBlank = nextNonBlankPlainLine(plainLines, j + 1);
        if (afterBlank && isLikelyParagraphFollow(afterBlank)) {
          break;
        }
        break;
      }

      if (kind === "table") {
        if (!looksLikeTableBoundary(candidate, nextCandidate)) break;
      } else {
        if (isHardBoundaryLine(candidate, nextCandidate)) break;
        if (isGroupingBoundaryLine(candidate)) break;
        if (looksLikeListSectionLabel(candidate)) break;

        if (kind === "bullet_list") {
          if (!isBulletListLine(candidate) || !isLikelyShortListLine(candidate)) break;
        } else if (kind === "numbered_list") {
          if (!isNumberedListLine(candidate) || !isLikelyShortListLine(candidate)) break;
        } else if (kind === "short_line_run") {
          if (!isLikelyShortListLine(candidate)) break;
        } else if (kind === "paragraph") {
          if (!isLikelyParagraphBlockLine(candidate)) break;
        }
      }

      const lineNumber = j + 1;
      if (firstAccepted === -1) firstAccepted = lineNumber;
      if (lineNumber - firstAccepted + 1 > MAX_GROUP_SPAN) {
        exceededSpan = true;
        break;
      }

      for (const id of collectEntityChildIds(candidate)) {
        childNodeIds.add(id);
      }

      itemCount++;
      lastAccepted = lineNumber;
      j++;
    }

    if (kind === "short_line_run" && itemCount < 2) kind = "none";
    if (kind === "bullet_list" && itemCount < 2) kind = "none";
    if (kind === "numbered_list" && itemCount < 2) kind = "none";
    if (kind === "table" && itemCount < 2) kind = "none";
    if (kind === "paragraph" && itemCount < 1) kind = "none";

    const signals: string[] = [];
    if (kind !== "none") {
      if (skippedBlank > 0) signals.push("label_gap");
      signals.push(`attached_${kind}`);
    }

    return {
      kind,
      firstLine: firstAccepted,
      lastLine: lastAccepted,
      itemCount,
      childNodeIds: Array.from(childNodeIds),
      exceededSpan,
      signals,
    };
  }

  function isSectionAlreadySolved(
    labelIndex: number,
    labelText: string,
    blockKind: AttachedBlockKind,
    itemCount: number,
    parentId?: string,
  ): boolean {
    const nearbyAnchor = hasNearbyStructureAnchor(labelIndex, 4, false);
    const parentNode = parentId ? idToHierarchy.get(parentId) : undefined;
    const parentStructured = parentNode?.role === "section" || parentNode?.role === "subsection";
    if (!nearbyAnchor && !parentStructured) return false;

    const labelCore = labelText.trim().replace(/:$/, "");
    const proceduralLabel =
      classifyProcedureLabel(labelCore) !== null || /^workflow$/i.test(labelCore) || /^steps?$/i.test(labelCore);

    if (blockKind === "table" || blockKind === "paragraph") return true;
    if (proceduralLabel && (blockKind === "bullet_list" || blockKind === "numbered_list")) {
      return false;
    }

    return itemCount <= 4;
  }

  let groupCounter = 0;
  function makeGroupId(kind: DocStructuralGroup["kind"]): string {
    groupCounter += 1;
    return `${kind}-${groupCounter}`;
  }

  const seenGroups = new Set<string>();
  function pushGroup(group: DocStructuralGroup) {
    const key = `${group.kind}|${group.title?.trim().toLowerCase() ?? ""}|${group.parentId ?? "root"}|${group.startLine ?? -1}`;
    if (seenGroups.has(key)) return;
    seenGroups.add(key);
    groups.push(group);
  }

  function tryEmitProcedureBlock(
    lineIndex: number,
    labelText: string,
    parentId: string | undefined,
    localHierarchyMissing: boolean,
  ): boolean {
    const procedureBlock = analyzeAttachedBlock(lineIndex);
    const procedureAttachKindValid =
      procedureBlock.kind === "numbered_list" ||
      procedureBlock.kind === "bullet_list" ||
      procedureBlock.kind === "short_line_run";

    if (
      !procedureAttachKindValid ||
      procedureBlock.exceededSpan ||
      procedureBlock.itemCount < 2 ||
      procedureBlock.firstLine === -1 ||
      procedureBlock.lastLine === -1
    ) {
      return false;
    }

    const spanStart = Math.max(1, lineIndex + 1 - tocLineOffset);
    // Keep procedure blocks line-anchored for safety: the detection relies on
    // attached-block evidence, but span metadata stays local to the label line.
    // This avoids HTML/TOC flattening drift that can misalign long spans.
    const spanEnd = spanStart;

    if (spanEnd < spanStart || spanEnd - spanStart + 1 > MAX_GROUP_SPAN) {
      return false;
    }

    const weakProcedureEvidence =
      procedureBlock.kind === "short_line_run" && procedureBlock.itemCount <= 2;
    const solved = isSectionAlreadySolved(
      lineIndex,
      labelText,
      procedureBlock.kind,
      procedureBlock.itemCount,
      parentId,
    );

    if (solved && weakProcedureEvidence) {
      return false;
    }

    const procedureSignals = ["procedure_label", ...procedureBlock.signals];
    if (localHierarchyMissing) {
      procedureSignals.push("local_hierarchy_missing");
    }
    procedureSignals.push("doc_structure_weak");

    let confidence = 0.8;
    if (procedureBlock.kind === "short_line_run") confidence = 0.76;

    pushGroup({
      id: makeGroupId("procedure_block"),
      kind: "procedure_block",
      title: labelText,
      parentId,
      childNodeIds:
        procedureBlock.childNodeIds.length > 0
          ? procedureBlock.childNodeIds
          : undefined,
      startLine: spanStart,
      endLine: spanEnd,
      confidence,
      signals: procedureSignals,
    });

    return true;
  }

  let currentGroupParentId = rootParentId;
  let lastStructuralAnchorLine = -1;

  for (let i = 0; i < plainLines.length; i++) {
    const raw = plainLines[i] ?? "";
    const line = normalizeGroupLine(raw);
    if (!line) continue;

    const matched = lineToHierarchy.get(line.toLowerCase()) ?? [];
    const parentCandidate =
      matched.find((n) => n.role === "subsection") ??
      matched.find((n) => n.role === "section") ??
      matched.find((n) => n.role === "title");
    if (parentCandidate) {
      currentGroupParentId = parentCandidate.id;
      lastStructuralAnchorLine = i;
    }

    if (documentStructureWeak) {
      const plainProcedureLabel = line.replace(/:$/, "").trim();
      const isProcedureLabel =
        classifyProcedureLabel(plainProcedureLabel) !== null ||
        classifyWorkflowLabel(plainProcedureLabel);

      if (isProcedureLabel) {
        const nearbyHierarchyAnchor = hasNearbyStructureAnchor(i, 3, false);
        const anchorRecencyMissing =
          lastStructuralAnchorLine < 0 || i - lastStructuralAnchorLine > 5;
        const localHierarchyMissing =
          !nearbyHierarchyAnchor && anchorRecencyMissing;

        if (
          tryEmitProcedureBlock(
            i,
            plainProcedureLabel,
            currentGroupParentId,
            localHierarchyMissing,
          )
        ) {
          continue;
        }
      }
    }

    if (looksLikeListSectionLabel(line)) {
      const labelText = line.replace(/:$/, "").trim();
      if (!documentStructureWeak) continue;

      const nearbyHierarchyAnchor = hasNearbyStructureAnchor(i, 3, false);
      const anchorRecencyMissing = lastStructuralAnchorLine < 0 || i - lastStructuralAnchorLine > 5;
      const localHierarchyMissing = !nearbyHierarchyAnchor && anchorRecencyMissing;

      if (hasImmediateHtmlTableAfterLabel(labelText)) {
        if (
          isSectionAlreadySolved(
            i,
            labelText,
            "table",
            1,
            currentGroupParentId,
          )
        ) {
          continue;
        }

        const tableSignals = ["label_colon", "attached_table_follow", "doc_structure_weak"];
        if (localHierarchyMissing) {
          tableSignals.push("local_hierarchy_missing");
        }

        pushGroup({
          id: makeGroupId("list_section"),
          kind: "list_section",
          title: labelText,
          parentId: currentGroupParentId,
          startLine: i + 1,
          endLine: i + 1,
          confidence: 0.74,
          signals: tableSignals,
        });
        continue;
      }

      const block = analyzeAttachedBlock(i);
      if (block.kind === "none" || block.exceededSpan) continue;
      if (block.firstLine === -1 || block.lastLine === -1) continue;

      const spanStart = i + 1;
      let spanEnd = block.lastLine;

      // Keep paragraph-attached list sections tightly scoped to the first
      // attached paragraph line so the span cannot bleed into later blocks.
      if (block.kind === "paragraph") {
        spanEnd = Math.max(spanStart, block.firstLine);

        // If a table follows this label region, keep the grouping as label-only.
        // HTML-to-text flattening can blur paragraph/table boundaries in line indices.
        if (hasNearbyHtmlTableAfterLabel(labelText)) {
          spanEnd = spanStart;
        }
      }

      // Hard stop: list_section span must never include table-style lines.
      while (spanEnd > spanStart) {
        const tail = normalizeGroupLine(plainLines[spanEnd - 1] ?? "");
        const tailNext = normalizeGroupLine(plainLines[spanEnd] ?? "");
        if (
          looksLikeTableBoundary(tail, tailNext) ||
          /^\|/.test(tail) ||
          /^<table\b/i.test(tail)
        ) {
          spanEnd -= 1;
          continue;
        }
        break;
      }

      if (spanEnd < spanStart) continue;
      if (spanEnd - spanStart + 1 > MAX_GROUP_SPAN) continue;

      if (
        isSectionAlreadySolved(
          i,
          labelText,
          block.kind,
          block.itemCount,
          currentGroupParentId,
        )
      ) {
        continue;
      }

      let confidence = 0.78;
      if (block.kind === "table") confidence = 0.74;
      if (block.kind === "paragraph") confidence = 0.66;

      const signals = ["label_colon", ...block.signals];
      if (localHierarchyMissing) {
        signals.push("local_hierarchy_missing");
      }
      signals.push("doc_structure_weak");

      pushGroup({
        id: makeGroupId("list_section"),
        kind: "list_section",
        title: labelText,
        parentId: currentGroupParentId,
        childNodeIds: block.childNodeIds.length > 0 ? block.childNodeIds : undefined,
        startLine: spanStart,
        endLine: spanEnd,
        confidence,
        signals,
      });
    }

    if (looksLikeProseSectionTitle(line)) {
      if (!documentStructureWeak) continue;

      const prevRaw = normalizeGroupLine(plainLines[i - 1] ?? "");
      const nextRaw = normalizeGroupLine(plainLines[i + 1] ?? "");
      const prevBoundary = !prevRaw || isGroupingBoundaryLine(prevRaw);
      const nextBoundary = !nextRaw || isGroupingBoundaryLine(nextRaw);

      if (!prevBoundary || !nextBoundary) continue;

      const follow = nextNonBlankPlainLine(plainLines, i + 1);
      if (!follow) continue;
      if (!isLikelyParagraphFollow(follow) && !isLikelyShortListLine(follow) && !/^\|.*\|$/.test(follow)) {
        continue;
      }

      pushGroup({
        id: makeGroupId("prose_section"),
        kind: "prose_section",
        title: line,
        parentId: currentGroupParentId,
        startLine: i + 1,
        endLine: i + 1,
        confidence: 0.72,
        signals: ["title_case_line", "paragraph_follow"],
      });
    }
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
    groups,
    hierarchy,
    titleBlock,
    summary,
    stats,
    normalizationNotes,
  };
}
