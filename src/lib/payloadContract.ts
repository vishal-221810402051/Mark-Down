import type { DocDiagnostics } from "./docDiagnostics";
import type { DocIntelligence, DocStructuralGroup } from "./docIntelligence";

export const SCHEMA_VERSION = "v1";
export const UNTITLED_DOCUMENT = "Untitled document";

export type ExternalDiagnostics = Omit<DocDiagnostics, "documentType"> & {
  documentType: string | null;
};

function titleCaseFromUnderscore(value: string): string {
  return value
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function toExternalDocumentType(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const known: Record<string, string> = {
    setup_guide: "Setup guide",
    roadmap: "Roadmap",
    architecture_doc: "Architecture document",
    technical_report: "Technical report",
    technical_doc: "Technical document",
    mixed_document: "Mixed document",
  };

  return known[normalized] ?? titleCaseFromUnderscore(normalized);
}

export function toExternalDiagnostics(
  diagnostics: DocDiagnostics | null | undefined,
): ExternalDiagnostics {
  const safe: DocDiagnostics = diagnostics ?? {
    items: [],
    summary: { info: 0, warning: 0, error: 0 },
    documentType: null,
    hierarchyGrade: "weak",
  };

  return {
    items: safe.items ?? [],
    summary: {
      info: safe.summary?.info ?? 0,
      warning: safe.summary?.warning ?? 0,
      error: safe.summary?.error ?? 0,
    },
    documentType: toExternalDocumentType(safe.documentType),
    hierarchyGrade: safe.hierarchyGrade,
  };
}

function filterExternalGroups(
  groups: DocStructuralGroup[] | undefined,
): DocStructuralGroup[] | undefined {
  if (!groups) return groups;
  return groups.filter((group) => group.kind !== "table_section");
}

export function toExternalIntelligence(
  intelligence: DocIntelligence | null | undefined,
): DocIntelligence | null {
  if (!intelligence) return null;

  return {
    ...intelligence,
    groups: filterExternalGroups(intelligence.groups),
  };
}

export function resolveExternalDocTitle(
  intelligence: DocIntelligence | null | undefined,
): string {
  const title = intelligence?.title?.trim();
  return title && title.length > 0 ? title : UNTITLED_DOCUMENT;
}

