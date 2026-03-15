import type { DocIntelligence } from "./docIntelligence";
import type { DocHeading, NormalizeStats } from "./docModel";

export type DiagnosticSeverity = "info" | "warning" | "error";
export type InferredDocumentType =
  | "setup_guide"
  | "roadmap"
  | "architecture_doc"
  | "technical_report"
  | "mixed_document";
export type HeadingHierarchyGrade = "strong" | "moderate" | "weak";

export type DocDiagnosticKind =
  | "plain_callout_candidate"
  | "unfenced_command_candidate"
  | "mermaid_risk"
  | "heading_hierarchy_issue"
  | "weak_section_structure"
  | "table_ambiguity";

export type DocDiagnostic = {
  kind: DocDiagnosticKind;
  severity: DiagnosticSeverity;
  message: string;
  detail?: string;
};

export type DocDiagnostics = {
  items: DocDiagnostic[];
  summary: {
    info: number;
    warning: number;
    error: number;
  };
  documentType: InferredDocumentType | null;
  hierarchyGrade: HeadingHierarchyGrade;
};

type ExtractParams = {
  rawText?: string;
  normalizedText: string;
  notes: string[];
  stats: NormalizeStats;
  renderedHtml: string;
  headings: DocHeading[];
  intelligence: DocIntelligence | null;
};

type LineContext = {
  lines: string[];
  trimmed: string[];
  prevNonBlank: string[];
  nextNonBlank: string[];
};

function buildLineContext(text: string): LineContext {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const trimmed = lines.map((line) => line.trim());
  const prevNonBlank: string[] = new Array(lines.length).fill("");
  const nextNonBlank: string[] = new Array(lines.length).fill("");

  let last = "";
  for (let i = 0; i < lines.length; i++) {
    prevNonBlank[i] = last;
    if (trimmed[i]) last = trimmed[i];
  }

  let next = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    nextNonBlank[i] = next;
    if (trimmed[i]) next = trimmed[i];
  }

  return { lines, trimmed, prevNonBlank, nextNonBlank };
}

function countBySeverity(items: DocDiagnostic[]) {
  return {
    info: items.filter((x) => x.severity === "info").length,
    warning: items.filter((x) => x.severity === "warning").length,
    error: items.filter((x) => x.severity === "error").length,
  };
}

function pushUnique(items: DocDiagnostic[], item: DocDiagnostic) {
  const exists = items.some(
    (x) =>
      x.kind === item.kind &&
      x.message === item.message &&
      (x.detail ?? "") === (item.detail ?? ""),
  );
  if (!exists) items.push(item);
}

function findPlainCalloutCandidates(ctx: LineContext): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  for (let i = 0; i < ctx.lines.length; i++) {
    const trimmed = ctx.trimmed[i] ?? "";
    const m = trimmed.match(/^(note|tip|warning|important|alert)\s*:\s*(.+)$/i);
    if (!m) continue;

    pushUnique(items, {
      kind: "plain_callout_candidate",
      severity: "info",
      message: `Plain ${m[1].toLowerCase()} callout candidate detected`,
      detail: trimmed,
    });
  }

  return items;
}

function findUnfencedCommandCandidates(ctx: LineContext): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  let inFence = false;
  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i] ?? "";
    const trimmed = ctx.trimmed[i] ?? "";

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence || !trimmed) continue;

    if (
      /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source|cp|mv|rm)\b/.test(
        trimmed,
      )
    ) {
      pushUnique(items, {
        kind: "unfenced_command_candidate",
        severity: "warning",
        message: "Possible unfenced command/setup line detected",
        detail: trimmed,
      });
    }
  }

  return items;
}

function findHeadingHierarchyIssues(
  headings: DocHeading[],
  intelligence: DocIntelligence | null,
): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  if (headings.length === 0) {
    pushUnique(items, {
      kind: "weak_section_structure",
      severity: "warning",
      message: "No headings detected",
    });
    return items;
  }

  const h1Count = headings.filter((h) => h.depth === 1).length;
  if (h1Count === 0 && !intelligence?.titleBlock?.title) {
    pushUnique(items, {
      kind: "heading_hierarchy_issue",
      severity: "warning",
      message: "Document has no H1 title",
    });
  }

  if (h1Count > 1) {
    pushUnique(items, {
      kind: "heading_hierarchy_issue",
      severity: "warning",
      message: `Document has multiple H1 headings (${h1Count})`,
    });
  }

  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    if (!prev || !curr) continue;
    if (curr.depth - prev.depth > 1) {
      pushUnique(items, {
        kind: "heading_hierarchy_issue",
        severity: "info",
        message: "Heading level jump detected",
        detail: `${prev.text} (H${prev.depth}) -> ${curr.text} (H${curr.depth})`,
      });
    }
  }

  return items;
}

function findWeakSectionStructure(intelligence: DocIntelligence | null): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  if (!intelligence) return items;

  const headingCount = intelligence.stats.headings;
  const roadmapCount = intelligence.stats.roadmaps;
  if (headingCount >= 8 && roadmapCount >= headingCount / 2) {
    pushUnique(items, {
      kind: "weak_section_structure",
      severity: "info",
      message: "Roadmap headings dominate document structure",
      detail: `${roadmapCount} roadmap headings out of ${headingCount} headings`,
    });
  }

  if (headingCount <= 2 && intelligence.summary.short) {
    pushUnique(items, {
      kind: "weak_section_structure",
      severity: "warning",
      message: "Document structure may be too sparse",
    });
  }

  return items;
}

function findTableAmbiguity(ctx: LineContext, intelligence: DocIntelligence | null): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  const pipeyParagraphs = ctx.trimmed.filter((t) => {
    return t.includes("|") && !/^\|.*\|$/.test(t) && t.length > 10;
  });

  if (pipeyParagraphs.length >= 2 && (intelligence?.stats.tables ?? 0) === 0) {
    pushUnique(items, {
      kind: "table_ambiguity",
      severity: "info",
      message: "Pipe-heavy text detected but no tables were parsed",
    });
  }

  return items;
}

function findMermaidRisks(
  text: string,
  html: string,
  intelligence: DocIntelligence | null,
): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  const mermaidFenceCount = (text.match(/```mermaid/g) ?? []).length;
  const mermaidDetected = intelligence?.stats.mermaidBlocks ?? 0;
  if (mermaidFenceCount > 0 && mermaidDetected === 0) {
    pushUnique(items, {
      kind: "mermaid_risk",
      severity: "warning",
      message: "Mermaid fences found but no Mermaid blocks detected",
    });
  }

  if (/syntax error/i.test(html)) {
    pushUnique(items, {
      kind: "mermaid_risk",
      severity: "error",
      message: "Preview contains Mermaid syntax error output",
    });
  }

  return items;
}

function suppressCommandContext(items: DocDiagnostic[], ctx: LineContext): DocDiagnostic[] {
  const suppressLabels = [
    /^expected output/i,
    /^verify database/i,
    /^run application/i,
    /^access ui/i,
    /^outputs/i,
  ];

  return items.filter((item) => {
    if (item.kind !== "unfenced_command_candidate") return true;
    const idx = ctx.trimmed.findIndex((t) => t === (item.detail ?? ""));
    if (idx <= 0) return true;
    const prev = ctx.trimmed[idx - 1] ?? "";
    return !suppressLabels.some((r) => r.test(prev));
  });
}

function groupCommandWarnings(items: DocDiagnostic[]): DocDiagnostic[] {
  const commands = items.filter((i) => i.kind === "unfenced_command_candidate");
  if (commands.length <= 2) return items;

  const others = items.filter((i) => i.kind !== "unfenced_command_candidate");
  return [
    ...others,
    {
      kind: "unfenced_command_candidate",
      severity: "warning",
      message: `${commands.length} possible unfenced command lines detected`,
    },
  ];
}

function inferPlainCallouts(
  ctx: LineContext,
  intelligence: DocIntelligence | null,
): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  const existing = intelligence?.callouts ?? [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i] ?? "";
    const trimmed = ctx.trimmed[i] ?? "";
    const m = trimmed.match(/^(note|tip|warning|important|alert)\s*:/i);
    if (!m) continue;

    const kind = m[1].toLowerCase();
    if (existing.some((c) => c.kind === kind)) continue;

    items.push({
      kind: "plain_callout_candidate",
      severity: "info",
      message: `Plain ${kind} callout candidate detected`,
      detail: trimmed,
    });
  }

  return items;
}

function inferDocumentType(intelligence: DocIntelligence | null): InferredDocumentType | null {
  if (!intelligence) return null;
  const s = intelligence.stats;
  if (s.commandBlocks > 10) return "setup_guide";
  if (s.roadmaps > 5) return "roadmap";
  if (s.tables > 5) return "architecture_doc";
  if (s.diagrams > 2 && s.procedures > 1) return "technical_report";
  return "mixed_document";
}

function gradeHeadingHierarchy(headings: DocHeading[]): HeadingHierarchyGrade {
  if (headings.length === 0) return "weak";

  const h1 = headings.filter((h) => h.depth === 1).length;
  if (h1 !== 1) return "moderate";

  let jumps = 0;
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    if (!prev || !curr) continue;
    if (curr.depth - prev.depth > 1) jumps++;
  }

  if (jumps > 0) return "moderate";
  return "strong";
}

export function extractDocDiagnostics(params: ExtractParams): DocDiagnostics {
  const { normalizedText, notes, stats, renderedHtml, headings, intelligence } = params;
  const ctx = buildLineContext(normalizedText);

  let items: DocDiagnostic[] = [];

  items.push(...findPlainCalloutCandidates(ctx));
  items.push(...findUnfencedCommandCandidates(ctx));
  items.push(...findHeadingHierarchyIssues(headings, intelligence));
  items.push(...findWeakSectionStructure(intelligence));
  items.push(...findTableAmbiguity(ctx, intelligence));
  items.push(...findMermaidRisks(normalizedText, renderedHtml, intelligence));
  items.push(...inferPlainCallouts(ctx, intelligence));

  if (stats.fencesAutoClosed > 0) {
    items.push({
      kind: "weak_section_structure",
      severity: "info",
      message: `Normalizer auto-closed ${stats.fencesAutoClosed} code fence(s)`,
    });
  }

  if (notes.some((n) => /converted wrapped table/i.test(n))) {
    items.push({
      kind: "table_ambiguity",
      severity: "info",
      message: "Normalizer converted one or more wrapped tables",
    });
  }

  items = suppressCommandContext(items, ctx);
  items = groupCommandWarnings(items);

  const documentType = inferDocumentType(intelligence);
  const hierarchyGrade = gradeHeadingHierarchy(headings);

  return {
    items,
    summary: countBySeverity(items),
    documentType,
    hierarchyGrade,
  };
}
