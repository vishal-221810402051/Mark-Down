import type { DocIntelligence } from "../docIntelligence";
import type { DocHeading, NormalizeStats } from "../docModel";

export type BenchmarkCategory =
  | "technical"
  | "research"
  | "business"
  | "tutorials"
  | "roadmaps"
  | "sop"
  | "tables"
  | "mixed"
  | "adversarial";

export type RiskSeverity = "info" | "warning" | "error";

export type BenchmarkRisk = {
  code: string;
  severity: RiskSeverity;
  message: string;
  value?: number;
};

export type BenchmarkMetrics = {
  wordCount: number;
  paragraphCount: number;
  headingCount: number;
  sectionCount: number;
  subsectionCount: number;
  subtitleCount: number;
  entityCount: number;
  procedureLabelCount: number;
  tableCount: number;
  codeBlockCount: number;
  commandBlockCount: number;
  diagramCount: number;
  calloutCount: number;
  phaseLikeCount: number;
  headingToParagraphRatio: number;
  sentenceLikeHeadingCount: number;
  tablePipeNoiseCount: number;
  truncatedTableRowCount: number;
  tableMergeRiskCount: number;
  weakHierarchySignalCount: number;
};

export type ScoreBreakdown = {
  hierarchyRichness: number;
  structuralConsistency: number;
  tableStability: number;
  labelDetection: number;
  entityDetection: number;
  categoryFitness: number;
  finalScore: number;
};

export type BenchmarkFingerprintInfo = {
  rawHash: string;
  normalizedHash: string;
  similarityHash: string;
  canonicalLineCount: number;
  canonicalTokenCount: number;
};

export type BenchmarkStructuralOutput = {
  normalizationNotes: string[];
  normalizationStats: NormalizeStats;
  parsedHeadings: DocHeading[];
  intelligence: DocIntelligence;
};

export type BenchmarkDocResult = {
  docId: string;
  category: BenchmarkCategory;
  fileName: string;
  relativePath: string;
  fingerprints: BenchmarkFingerprintInfo;
  structures: BenchmarkStructuralOutput;
  metrics: BenchmarkMetrics;
  risks: BenchmarkRisk[];
  diagnostics: {
    info: number;
    warning: number;
    error: number;
    items: Array<{ kind: string; severity: string; message: string; detail?: string }>;
  };
  score: ScoreBreakdown;
};

export type BenchmarkDuplicateGroupType =
  | "exact_raw"
  | "exact_normalized"
  | "near_normalized";

export type BenchmarkDuplicateGroupMember = {
  docId: string;
  category: BenchmarkCategory;
  relativePath: string;
  score: number;
  rawHash: string;
  normalizedHash: string;
};

export type BenchmarkDuplicateGroup = {
  id: string;
  duplicateType: BenchmarkDuplicateGroupType;
  representative: BenchmarkDuplicateGroupMember;
  members: BenchmarkDuplicateGroupMember[];
  categorySpread: BenchmarkCategory[];
  similarity?: number;
};

export type BenchmarkDuplicateCategorySummary = {
  category: BenchmarkCategory;
  totalDocs: number;
  uniqueRawDocs: number;
  uniqueNormalizedDocs: number;
  duplicateDocCount: number;
  duplicateRate: number;
  nearDuplicateDocCount: number;
  nearDuplicateRate: number;
  lowDiversity: boolean;
};

export type BenchmarkDuplicateSummary = {
  totalDocs: number;
  uniqueRawDocs: number;
  uniqueNormalizedDocs: number;
  duplicateDocCount: number;
  duplicateRate: number;
  nearDuplicateDocCount: number;
  nearDuplicateRate: number;
  perCategory: BenchmarkDuplicateCategorySummary[];
  lowDiversityCategories: BenchmarkCategory[];
  warnings: string[];
};

export type BenchmarkScoreInterpretation = {
  naiveAvgScore: number;
  uniqueRawAvgScore: number;
  uniqueNormalizedAvgScore: number;
  uniqueNormalizedCategoryAverages: Array<{
    category: BenchmarkCategory;
    uniqueRepresentativeCount: number;
    avgScore: number;
  }>;
};

export type CategorySummary = {
  category: BenchmarkCategory;
  count: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  avgHeadings: number;
  avgEntities: number;
  avgTables: number;
  riskCount: number;
};

export type BenchmarkRunResult = {
  generatedAt: string;
  docsRoot: string;
  outputRoot: string;
  totalDocs: number;
  avgScore: number;
  categorySummaries: CategorySummary[];
  duplicateAnalysis: {
    summary: BenchmarkDuplicateSummary;
    exactRawGroups: BenchmarkDuplicateGroup[];
    exactNormalizedGroups: BenchmarkDuplicateGroup[];
    nearDuplicateGroups: BenchmarkDuplicateGroup[];
    reliabilityNotes: string[];
  };
  scoreInterpretation: BenchmarkScoreInterpretation;
  recurringRiskPatterns: Array<{ code: string; count: number }>;
  top10: Array<{ docId: string; category: BenchmarkCategory; score: number; relativePath: string }>;
  worst10: Array<{ docId: string; category: BenchmarkCategory; score: number; relativePath: string }>;
  docs: BenchmarkDocResult[];
};
