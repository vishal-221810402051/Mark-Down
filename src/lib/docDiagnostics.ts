import type { DocIntelligence } from "./docIntelligence";
import type { DocHeading, NormalizeStats } from "./docModel";

export type DiagnosticSeverity = "info" | "warning" | "error";

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

function findPlainCalloutCandidates(text: string): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
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

function findUnfencedCommandCandidates(text: string): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;
  for (const line of lines) {
    const trimmed = line.trim();

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

function findHeadingHierarchyIssues(headings: DocHeading[]): DocDiagnostic[] {
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
  if (h1Count === 0) {
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

function findTableAmbiguity(text: string, intelligence: DocIntelligence | null): DocDiagnostic[] {
  const items: DocDiagnostic[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const pipeyParagraphs = lines.filter((line) => {
    const t = line.trim();
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

export function extractDocDiagnostics(params: ExtractParams): DocDiagnostics {
  const { normalizedText, notes, stats, renderedHtml, headings, intelligence } = params;

  const items: DocDiagnostic[] = [];

  for (const item of findPlainCalloutCandidates(normalizedText)) items.push(item);
  for (const item of findUnfencedCommandCandidates(normalizedText)) items.push(item);
  for (const item of findHeadingHierarchyIssues(headings)) items.push(item);
  for (const item of findWeakSectionStructure(intelligence)) items.push(item);
  for (const item of findTableAmbiguity(normalizedText, intelligence)) items.push(item);
  for (const item of findMermaidRisks(normalizedText, renderedHtml, intelligence))
    items.push(item);

  if (stats.fencesAutoClosed > 0) {
    pushUnique(items, {
      kind: "weak_section_structure",
      severity: "info",
      message: `Normalizer auto-closed ${stats.fencesAutoClosed} code fence(s)`,
    });
  }

  if (notes.some((n) => /converted wrapped table/i.test(n))) {
    pushUnique(items, {
      kind: "table_ambiguity",
      severity: "info",
      message: "Normalizer converted one or more wrapped tables",
    });
  }

  return {
    items,
    summary: countBySeverity(items),
  };
}
