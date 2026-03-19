#!/usr/bin/env tsx

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { extractDocDiagnostics } from "../src/lib/docDiagnostics";
import { normalizeInput } from "../src/lib/normalize";
import { parseMarkdownToHtml } from "../src/lib/parse";
import type {
  BenchmarkCategory,
  BenchmarkDocResult,
  BenchmarkDuplicateCategorySummary,
  BenchmarkDuplicateGroup,
  BenchmarkDuplicateGroupMember,
  BenchmarkMetrics,
  BenchmarkRisk,
  BenchmarkRunResult,
  BenchmarkScoreInterpretation,
  CategorySummary,
  RiskSeverity,
  ScoreBreakdown,
} from "../src/lib/benchmark/types";

type DocEntry = {
  docId: string;
  fileName: string;
  category: BenchmarkCategory;
  absPath: string;
  relativePath: string;
};

type CategoryEval = {
  score01: number;
  risks: BenchmarkRisk[];
};

type SimilarityProfile = {
  canonicalLines: string[];
  canonicalLineSet: Set<string>;
  canonicalTokenSet: Set<string>;
};

type EvaluatedDoc = {
  result: BenchmarkDocResult;
  similarityProfile: SimilarityProfile;
};

const CATEGORY_ORDER: BenchmarkCategory[] = [
  "technical",
  "research",
  "business",
  "tutorials",
  "roadmaps",
  "sop",
  "tables",
  "mixed",
  "adversarial",
];

const PROCEDURE_LABEL_PATTERN =
  /^(steps?|workflow|procedure|checklist|validation|deliverables?|acceptance checks?|goals?|requirements?|run|implementation|overview|notes?)$/i;
const NEAR_DUPLICATE_THRESHOLD = 0.93;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function addRisk(
  list: BenchmarkRisk[],
  code: string,
  severity: RiskSeverity,
  message: string,
  value?: number,
) {
  list.push({ code, severity, message, value });
}

function parseArg(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function canonicalizeLine(line: string): string {
  return line.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildSimilarityProfile(text: string): SimilarityProfile {
  const canonicalLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(canonicalizeLine)
    .filter(Boolean);
  const canonicalLineSet = new Set(canonicalLines);
  const canonicalTokenSet = new Set(
    canonicalLines
      .join(" ")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2),
  );

  return {
    canonicalLines,
    canonicalLineSet,
    canonicalTokenSet,
  };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) {
    if (large.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function listBenchmarkDocs(root: string): Promise<DocEntry[]> {
  const docs: DocEntry[] = [];
  for (const category of CATEGORY_ORDER) {
    const catDir = path.join(root, category);
    let entries: Array<{ name: string; isFile: () => boolean }> = [];
    try {
      entries = await fs.readdir(catDir, { withFileTypes: true }) as Array<{
        name: string;
        isFile: () => boolean;
      }>;
    } catch {
      continue;
    }

    const files = entries
      .filter((entry) => entry.isFile() && /^doc_\d+\.md$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => {
        const an = Number((a.match(/\d+/) ?? ["0"])[0]);
        const bn = Number((b.match(/\d+/) ?? ["0"])[0]);
        return an - bn;
      });

    for (const fileName of files) {
      const docId = fileName.replace(/\.md$/i, "");
      const absPath = path.join(catDir, fileName);
      docs.push({
        docId,
        fileName,
        category,
        absPath,
        relativePath: path.relative(root, absPath).replace(/\\/g, "/"),
      });
    }
  }
  return docs;
}

function countWords(text: string): number {
  const m = text.match(/[A-Za-z0-9]+/g);
  return m ? m.length : 0;
}

function estimateParagraphCount(text: string): number {
  return text
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => !/^```/.test(p))
    .filter((p) => !/^\|.+\|$/m.test(p))
    .length;
}

function countSentenceLikeHeadings(headings: Array<{ text: string }>): number {
  let count = 0;
  for (const h of headings) {
    const s = h.text.trim();
    if (!s) continue;
    const words = s.split(/\s+/).filter(Boolean);
    const sentenceLike =
      (/:$/.test(s) &&
        /\b(should|must|will|can|could|would|may|might|is|are|was|were)\b/i.test(s)) ||
      (words.length >= 8 &&
        /\b(this|that|these|those|system|document|should|must|will|can)\b/i.test(s));
    if (sentenceLike) count++;
  }
  return count;
}

function tableCorruptionSignals(normalizedText: string): {
  pipeNoise: number;
  truncatedRows: number;
  mergeRisk: number;
} {
  const lines = normalizedText.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;
  let pipeNoise = 0;
  let truncatedRows = 0;
  let mergeRisk = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const t = line.trim();
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !t) continue;

    const isTableRow = /^\|.*\|$/.test(t);
    if (t.includes("|") && !isTableRow) pipeNoise++;
    if (/^\|/.test(t) && !/\|$/.test(t)) truncatedRows++;

    if (isTableRow) {
      const prev = (lines[i - 1] ?? "").trim();
      const next = (lines[i + 1] ?? "").trim();
      const prevTable = /^\|.*\|$/.test(prev);
      const nextTable = /^\|.*\|$/.test(next);
      if (prevTable && next && !nextTable && !/^[-:| ]+$/.test(next)) {
        mergeRisk++;
      }
    }
  }

  return { pipeNoise, truncatedRows, mergeRisk };
}

function evaluateCategory(
  category: BenchmarkCategory,
  metrics: BenchmarkMetrics,
  normalizedText: string,
  headings: Array<{ text: string }>,
): CategoryEval {
  const risks: BenchmarkRisk[] = [];
  const headingText = headings.map((h) => h.text.toLowerCase());
  const lower = normalizedText.toLowerCase();
  const hasKeywords = (keywords: string[]) =>
    keywords.filter((k) => headingText.some((h) => h.includes(k)) || lower.includes(k))
      .length;

  let score = 1;
  switch (category) {
    case "technical": {
      if (metrics.sectionCount < 2) {
        addRisk(risks, "technical_low_sections", "warning", "Technical doc has weak section structure");
      }
      if (metrics.entityCount === 0) {
        addRisk(risks, "technical_no_entities", "warning", "Technical doc produced zero entities");
      }
      score = clamp(
        (metrics.sectionCount >= 2 ? 0.4 : 0) +
          (metrics.entityCount > 0 ? 0.3 : 0) +
          (metrics.codeBlockCount > 0 ? 0.15 : 0) +
          (metrics.tableCount > 0 ? 0.15 : 0),
        0,
        1,
      );
      break;
    }
    case "research": {
      const hit = hasKeywords([
        "abstract",
        "introduction",
        "methodology",
        "results",
        "discussion",
        "conclusion",
        "references",
      ]);
      if (hit < 4) {
        addRisk(risks, "research_missing_core_sections", "warning", "Research doc is missing expected section family");
      }
      score = clamp(hit / 7, 0, 1);
      break;
    }
    case "business": {
      const hit = hasKeywords([
        "executive summary",
        "business objectives",
        "market opportunity",
        "product strategy",
        "revenue model",
        "risk assessment",
      ]);
      if (hit < 3) {
        addRisk(risks, "business_missing_strategy_sections", "warning", "Business doc is missing key strategy sections");
      }
      score = clamp(hit / 6, 0, 1);
      break;
    }
    case "tutorials": {
      if (metrics.procedureLabelCount === 0) {
        addRisk(risks, "tutorial_no_procedure_labels", "error", "Tutorial has no procedure/workflow/checklist labels");
      }
      if (metrics.commandBlockCount + metrics.codeBlockCount === 0) {
        addRisk(risks, "tutorial_no_commands_or_code", "warning", "Tutorial has no command/code blocks");
      }
      score = clamp(
        (metrics.procedureLabelCount > 0 ? 0.45 : 0) +
          (metrics.commandBlockCount + metrics.codeBlockCount > 0 ? 0.35 : 0) +
          (metrics.tableCount > 0 ? 0.2 : 0),
        0,
        1,
      );
      break;
    }
    case "roadmaps": {
      if (metrics.phaseLikeCount === 0) {
        addRisk(risks, "roadmap_no_phase_structure", "error", "Roadmap doc produced zero phase-like structure");
      }
      score = clamp(
        (metrics.phaseLikeCount >= 2 ? 0.7 : metrics.phaseLikeCount > 0 ? 0.4 : 0) +
          (metrics.sectionCount > 0 ? 0.3 : 0),
        0,
        1,
      );
      break;
    }
    case "sop": {
      if (metrics.procedureLabelCount === 0) {
        addRisk(risks, "sop_no_procedure_labels", "error", "SOP doc has zero procedure/checklist labels");
      }
      score = clamp(
        (metrics.procedureLabelCount > 0 ? 0.65 : 0) +
          (metrics.tableCount > 0 ? 0.2 : 0) +
          (metrics.sectionCount > 1 ? 0.15 : 0),
        0,
        1,
      );
      break;
    }
    case "tables": {
      if (metrics.tableCount < 5) {
        addRisk(risks, "tables_low_count", "error", "Table-heavy report has fewer than 5 parsed tables", metrics.tableCount);
      }
      if (metrics.tablePipeNoiseCount > 0 || metrics.truncatedTableRowCount > 0) {
        addRisk(risks, "tables_corruption", "warning", "Table-heavy report has table corruption indicators");
      }
      score = clamp(
        (metrics.tableCount >= 8 ? 0.75 : metrics.tableCount >= 5 ? 0.55 : 0.2) +
          (metrics.tablePipeNoiseCount + metrics.truncatedTableRowCount === 0 ? 0.25 : 0.05),
        0,
        1,
      );
      break;
    }
    case "mixed": {
      const typeCount = [
        metrics.tableCount > 0,
        metrics.codeBlockCount + metrics.commandBlockCount > 0,
        metrics.diagramCount > 0,
        metrics.calloutCount > 0,
        metrics.phaseLikeCount > 0,
        metrics.procedureLabelCount > 0,
      ].filter(Boolean).length;
      if (typeCount < 4) {
        addRisk(risks, "mixed_low_diversity", "warning", "Mixed doc has low structural diversity");
      }
      score = clamp(typeCount / 6, 0, 1);
      break;
    }
    case "adversarial": {
      // Intentionally lenient; we still surface anomalies via risk list.
      score = 0.7;
      break;
    }
  }

  return { score01: score, risks };
}

function computeScores(
  category: BenchmarkCategory,
  metrics: BenchmarkMetrics,
  riskCount: number,
  categoryFitness01: number,
  headingHierarchyIssueCount: number,
): ScoreBreakdown {
  const hierarchyRichness = clamp(
    (metrics.headingCount >= 3 ? 8 : metrics.headingCount > 0 ? 4 : 0) +
      (metrics.sectionCount >= 2 ? 7 : metrics.sectionCount > 0 ? 4 : 0) +
      (metrics.subsectionCount > 0 ? 5 : 0) +
      (metrics.subtitleCount > 0 ? 2 : 0) +
      (metrics.weakHierarchySignalCount > 0 ? -4 : 0),
    0,
    25,
  );

  const structuralConsistency = clamp(
    20 -
      metrics.sentenceLikeHeadingCount * 2 -
      headingHierarchyIssueCount * 2 -
      metrics.weakHierarchySignalCount * 3,
    0,
    20,
  );

  const tableBase = metrics.tableCount > 0 ? 12 : category === "tables" ? 2 : 8;
  const tableStability = clamp(
    tableBase +
      Math.min(3, metrics.tableCount / 3) -
      metrics.tablePipeNoiseCount -
      metrics.truncatedTableRowCount * 2 -
      metrics.tableMergeRiskCount,
    0,
    15,
  );

  const labelDetection = clamp(
    (metrics.procedureLabelCount > 0 ? 7 : 0) +
      (metrics.procedureLabelCount >= 3 ? 5 : 0) +
      (["tutorials", "sop", "roadmaps"].includes(category) && metrics.procedureLabelCount === 0
        ? -6
        : 0),
    0,
    15,
  );

  const entityDetection = clamp(
    (metrics.entityCount > 0 ? 6 : 0) +
      (metrics.entityCount >= 3 ? 3 : 0) +
      ((category === "technical" || category === "mixed") && metrics.entityCount === 0 ? -3 : 0),
    0,
    10,
  );

  const anomalyPenalty = Math.min(8, riskCount);
  const categoryFitness = clamp(categoryFitness01 * 15 - anomalyPenalty, 0, 15);

  const finalScore = clamp(
    Math.round(
      hierarchyRichness +
        structuralConsistency +
        tableStability +
        labelDetection +
        entityDetection +
        categoryFitness,
    ),
    0,
    100,
  );

  return {
    hierarchyRichness: round2(hierarchyRichness),
    structuralConsistency: round2(structuralConsistency),
    tableStability: round2(tableStability),
    labelDetection: round2(labelDetection),
    entityDetection: round2(entityDetection),
    categoryFitness: round2(categoryFitness),
    finalScore,
  };
}

function duplicateMember(doc: BenchmarkDocResult): BenchmarkDuplicateGroupMember {
  return {
    docId: doc.docId,
    category: doc.category,
    relativePath: doc.relativePath,
    score: doc.score.finalScore,
    rawHash: doc.fingerprints.rawHash,
    normalizedHash: doc.fingerprints.normalizedHash,
  };
}

function pickRepresentative(docs: BenchmarkDocResult[]): BenchmarkDocResult {
  return [...docs].sort((a, b) => {
    if (b.score.finalScore !== a.score.finalScore) return b.score.finalScore - a.score.finalScore;
    return a.relativePath.localeCompare(b.relativePath);
  })[0] as BenchmarkDocResult;
}

function groupedMembers(docs: BenchmarkDocResult[]): BenchmarkDuplicateGroupMember[] {
  return docs
    .map(duplicateMember)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function categorySpread(docs: BenchmarkDocResult[]): BenchmarkCategory[] {
  return Array.from(new Set(docs.map((d) => d.category))).sort() as BenchmarkCategory[];
}

function makeDuplicateGroup(
  id: string,
  duplicateType: BenchmarkDuplicateGroup["duplicateType"],
  docs: BenchmarkDocResult[],
  similarity?: number,
): BenchmarkDuplicateGroup {
  const representativeDoc = pickRepresentative(docs);
  return {
    id,
    duplicateType,
    representative: duplicateMember(representativeDoc),
    members: groupedMembers(docs),
    categorySpread: categorySpread(docs),
    similarity: similarity !== undefined ? round2(similarity) : undefined,
  };
}

function buildHashGroups(
  docs: BenchmarkDocResult[],
  keySelector: (doc: BenchmarkDocResult) => string,
  type: "exact_raw" | "exact_normalized",
): BenchmarkDuplicateGroup[] {
  const map = new Map<string, BenchmarkDocResult[]>();
  for (const doc of docs) {
    const key = keySelector(doc);
    const arr = map.get(key) ?? [];
    arr.push(doc);
    map.set(key, arr);
  }

  const groups: BenchmarkDuplicateGroup[] = [];
  for (const [hash, members] of map.entries()) {
    if (members.length < 2) continue;
    groups.push(makeDuplicateGroup(`${type}-${hash.slice(0, 12)}`, type, members));
  }

  return groups.sort((a, b) => b.members.length - a.members.length);
}

function buildNearDuplicateGroups(
  docs: BenchmarkDocResult[],
  profiles: SimilarityProfile[],
): BenchmarkDuplicateGroup[] {
  const n = docs.length;
  if (n < 2) return [];

  const parent = new Array<number>(n).fill(0).map((_, i) => i);
  const pairScores = new Map<string, number>();

  const find = (x: number): number => {
    if (parent[x] === x) return x;
    parent[x] = find(parent[x] as number);
    return parent[x] as number;
  };

  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (docs[i]?.fingerprints.normalizedHash === docs[j]?.fingerprints.normalizedHash) {
        continue;
      }

      const p1 = profiles[i] as SimilarityProfile;
      const p2 = profiles[j] as SimilarityProfile;
      const lineScore = jaccard(p1.canonicalLineSet, p2.canonicalLineSet);
      if (lineScore < 0.85) continue;
      const tokenScore = jaccard(p1.canonicalTokenSet, p2.canonicalTokenSet);
      const combined = lineScore * 0.65 + tokenScore * 0.35;
      if (combined >= NEAR_DUPLICATE_THRESHOLD) {
        union(i, j);
        pairScores.set(`${i}:${j}`, combined);
      }
    }
  }

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const arr = clusters.get(root) ?? [];
    arr.push(i);
    clusters.set(root, arr);
  }

  const groups: BenchmarkDuplicateGroup[] = [];
  for (const idxs of clusters.values()) {
    if (idxs.length < 2) continue;
    const memberDocs = idxs.map((idx) => docs[idx] as BenchmarkDocResult);

    let sum = 0;
    let count = 0;
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const i = idxs[a] as number;
        const j = idxs[b] as number;
        const key = i < j ? `${i}:${j}` : `${j}:${i}`;
        const score = pairScores.get(key);
        if (score !== undefined) {
          sum += score;
          count++;
        }
      }
    }

    const representativeDoc = pickRepresentative(memberDocs);
    const groupId = `near-${representativeDoc.docId.toLowerCase()}-${idxs.length}`;
    groups.push(
      makeDuplicateGroup(
        groupId,
        "near_normalized",
        memberDocs,
        count > 0 ? sum / count : NEAR_DUPLICATE_THRESHOLD,
      ),
    );
  }

  return groups.sort((a, b) => b.members.length - a.members.length);
}

function buildScoreInterpretation(
  docs: BenchmarkDocResult[],
  naiveAvgScore: number,
): BenchmarkScoreInterpretation {
  const rawRep = new Map<string, BenchmarkDocResult>();
  const normalizedRep = new Map<string, BenchmarkDocResult>();

  for (const doc of docs) {
    const rawExisting = rawRep.get(doc.fingerprints.rawHash);
    if (!rawExisting || doc.score.finalScore > rawExisting.score.finalScore) {
      rawRep.set(doc.fingerprints.rawHash, doc);
    }

    const normExisting = normalizedRep.get(doc.fingerprints.normalizedHash);
    if (!normExisting || doc.score.finalScore > normExisting.score.finalScore) {
      normalizedRep.set(doc.fingerprints.normalizedHash, doc);
    }
  }

  const uniqueRawAvgScore = round2(mean(Array.from(rawRep.values()).map((d) => d.score.finalScore)));
  const uniqueNormalizedAvgScore = round2(
    mean(Array.from(normalizedRep.values()).map((d) => d.score.finalScore)),
  );

  const uniqueNormalizedCategoryAverages = CATEGORY_ORDER.map((category) => {
    const categoryDocs = docs.filter((d) => d.category === category);
    const reps = new Map<string, BenchmarkDocResult>();
    for (const doc of categoryDocs) {
      const existing = reps.get(doc.fingerprints.normalizedHash);
      if (!existing || doc.score.finalScore > existing.score.finalScore) {
        reps.set(doc.fingerprints.normalizedHash, doc);
      }
    }

    return {
      category,
      uniqueRepresentativeCount: reps.size,
      avgScore: round2(mean(Array.from(reps.values()).map((d) => d.score.finalScore))),
    };
  });

  return {
    naiveAvgScore: round2(naiveAvgScore),
    uniqueRawAvgScore,
    uniqueNormalizedAvgScore,
    uniqueNormalizedCategoryAverages,
  };
}

function buildDuplicateAnalysis(
  docs: BenchmarkDocResult[],
  profiles: SimilarityProfile[],
  scoreInterpretation: BenchmarkScoreInterpretation,
) {
  const exactRawGroups = buildHashGroups(docs, (d) => d.fingerprints.rawHash, "exact_raw");
  const exactNormalizedGroups = buildHashGroups(
    docs,
    (d) => d.fingerprints.normalizedHash,
    "exact_normalized",
  );
  const nearDuplicateGroups = buildNearDuplicateGroups(docs, profiles);

  const totalDocs = docs.length;
  const uniqueRawDocs = new Set(docs.map((d) => d.fingerprints.rawHash)).size;
  const uniqueNormalizedDocs = new Set(docs.map((d) => d.fingerprints.normalizedHash)).size;
  const duplicateDocCount = totalDocs - uniqueNormalizedDocs;
  const duplicateRate = round2(duplicateDocCount / Math.max(1, totalDocs));
  const nearDuplicatePathSet = new Set<string>();
  for (const group of nearDuplicateGroups) {
    for (const member of group.members) {
      nearDuplicatePathSet.add(member.relativePath);
    }
  }
  const nearDuplicateDocCount = nearDuplicatePathSet.size;
  const nearDuplicateRate = round2(nearDuplicateDocCount / Math.max(1, totalDocs));

  const perCategory: BenchmarkDuplicateCategorySummary[] = CATEGORY_ORDER.map((category) => {
    const catDocs = docs.filter((d) => d.category === category);
    const uniqueRaw = new Set(catDocs.map((d) => d.fingerprints.rawHash)).size;
    const uniqueNormalized = new Set(catDocs.map((d) => d.fingerprints.normalizedHash)).size;
    const dupCount = catDocs.length - uniqueNormalized;
    const dupRate = round2(dupCount / Math.max(1, catDocs.length));
    const nearDupCount = catDocs.filter((d) => nearDuplicatePathSet.has(d.relativePath)).length;
    const nearDupRate = round2(nearDupCount / Math.max(1, catDocs.length));
    const lowDiversity =
      catDocs.length >= 3 &&
      (
        uniqueNormalized <= Math.max(1, Math.floor(catDocs.length * 0.5)) ||
        dupRate >= 0.5 ||
        nearDupRate >= 0.6
      );

    return {
      category,
      totalDocs: catDocs.length,
      uniqueRawDocs: uniqueRaw,
      uniqueNormalizedDocs: uniqueNormalized,
      duplicateDocCount: dupCount,
      duplicateRate: dupRate,
      nearDuplicateDocCount: nearDupCount,
      nearDuplicateRate: nearDupRate,
      lowDiversity,
    };
  });

  const lowDiversityCategories = perCategory
    .filter((x) => x.lowDiversity)
    .map((x) => x.category);

  const warnings: string[] = [];
  for (const item of perCategory) {
    if (item.lowDiversity) {
      if (item.duplicateDocCount > 0) {
        warnings.push(
          `Category ${item.category} contains ${item.totalDocs} docs but only ${item.uniqueNormalizedDocs} unique content pattern(s).`,
        );
      } else {
        warnings.push(
          `Category ${item.category} shows low diversity: ${item.nearDuplicateDocCount}/${item.totalDocs} docs are near-duplicates.`,
        );
      }
    }
  }

  if (duplicateDocCount > 0) {
    warnings.push(
      `Overall benchmark has ${totalDocs} docs but only ${uniqueNormalizedDocs} unique normalized documents.`,
    );
  }

  if (duplicateRate >= 0.35) {
    warnings.push("Average score may overstate robustness because of repeated content.");
  }
  if (nearDuplicateRate >= 0.35) {
    warnings.push(
      `Near-duplicate coverage is high (${nearDuplicateDocCount}/${totalDocs} docs); benchmark variety may be narrower than doc count suggests.`,
    );
  }

  const reliabilityNotes: string[] = [];
  reliabilityNotes.push(
    `Naive average score: ${scoreInterpretation.naiveAvgScore}; unique-normalized average score: ${scoreInterpretation.uniqueNormalizedAvgScore}.`,
  );
  if (nearDuplicateGroups.length > 0) {
    reliabilityNotes.push(
      `${nearDuplicateGroups.length} near-duplicate group(s) detected with threshold ${NEAR_DUPLICATE_THRESHOLD}.`,
    );
  }
  if (lowDiversityCategories.length > 0) {
    reliabilityNotes.push(
      `Low-diversity categories: ${lowDiversityCategories.join(", ")}.`,
    );
  }

  return {
    summary: {
      totalDocs,
      uniqueRawDocs,
      uniqueNormalizedDocs,
      duplicateDocCount,
      duplicateRate,
      nearDuplicateDocCount,
      nearDuplicateRate,
      perCategory,
      lowDiversityCategories,
      warnings,
    },
    exactRawGroups,
    exactNormalizedGroups,
    nearDuplicateGroups,
    reliabilityNotes,
  };
}

function markdownSummary(result: BenchmarkRunResult): string {
  const categoryRows = result.categorySummaries
    .map(
      (s) =>
        `| ${s.category} | ${s.count} | ${s.avgScore} | ${s.minScore} | ${s.maxScore} | ${s.avgHeadings} | ${s.avgEntities} | ${s.avgTables} | ${s.riskCount} |`,
    )
    .join("\n");

  const topRows = result.top10
    .map((x) => `| ${x.docId} | ${x.category} | ${x.score} | ${x.relativePath} |`)
    .join("\n");

  const worstRows = result.worst10
    .map((x) => `| ${x.docId} | ${x.category} | ${x.score} | ${x.relativePath} |`)
    .join("\n");

  const recurring = result.recurringRiskPatterns
    .slice(0, 15)
    .map((r) => `- \`${r.code}\`: ${r.count}`)
    .join("\n");

  const dup = result.duplicateAnalysis.summary;
  const dupCategoryRows = dup.perCategory
    .map(
      (c) =>
        `| ${c.category} | ${c.totalDocs} | ${c.uniqueRawDocs} | ${c.uniqueNormalizedDocs} | ${c.duplicateDocCount} | ${c.duplicateRate} | ${c.nearDuplicateDocCount} | ${c.nearDuplicateRate} | ${c.lowDiversity ? "yes" : "no"} |`,
    )
    .join("\n");

  const uniqueCategoryRows = result.scoreInterpretation.uniqueNormalizedCategoryAverages
    .map(
      (c) =>
        `| ${c.category} | ${c.uniqueRepresentativeCount} | ${c.avgScore} |`,
    )
    .join("\n");

  const lowDiversity = dup.lowDiversityCategories.length
    ? dup.lowDiversityCategories.map((c) => `- ${c}`).join("\n")
    : "- none";
  const reliabilityNotes = result.duplicateAnalysis.reliabilityNotes.length
    ? result.duplicateAnalysis.reliabilityNotes.map((x) => `- ${x}`).join("\n")
    : "- none";
  const dupWarnings = dup.warnings.length
    ? dup.warnings.map((x) => `- ${x}`).join("\n")
    : "- none";
  const exactGroupsPreview = result.duplicateAnalysis.exactNormalizedGroups
    .slice(0, 8)
    .map(
      (g) =>
        `- \`${g.id}\` (${g.members.length} docs) representative: ${g.representative.relativePath}`,
    )
    .join("\n");
  const nearGroupsPreview = result.duplicateAnalysis.nearDuplicateGroups
    .slice(0, 8)
    .map(
      (g) =>
        `- \`${g.id}\` (${g.members.length} docs, similarity ${g.similarity ?? NEAR_DUPLICATE_THRESHOLD}) representative: ${g.representative.relativePath}`,
    )
    .join("\n");

  return [
    "# Benchmark Summary",
    "",
    `Generated: ${result.generatedAt}`,
    `Total docs: ${result.totalDocs}`,
    `Average score: ${result.avgScore}`,
    "",
    "## Category Scores",
    "",
    "| Category | Docs | Avg | Min | Max | Avg Headings | Avg Entities | Avg Tables | Risks |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    categoryRows,
    "",
    "## Top 10 Documents",
    "",
    "| Doc ID | Category | Score | Path |",
    "|---|---|---:|---|",
    topRows,
    "",
    "## Worst 10 Documents",
    "",
    "| Doc ID | Category | Score | Path |",
    "|---|---|---:|---|",
    worstRows,
    "",
    "## Duplicate Analysis",
    "",
    `- Total docs: ${dup.totalDocs}`,
    `- Unique raw docs: ${dup.uniqueRawDocs}`,
    `- Unique normalized docs: ${dup.uniqueNormalizedDocs}`,
    `- Duplicate doc count: ${dup.duplicateDocCount}`,
    `- Duplicate rate: ${dup.duplicateRate}`,
    `- Near-duplicate doc count: ${dup.nearDuplicateDocCount}`,
    `- Near-duplicate rate: ${dup.nearDuplicateRate}`,
    `- Exact raw duplicate groups: ${result.duplicateAnalysis.exactRawGroups.length}`,
    `- Exact normalized duplicate groups: ${result.duplicateAnalysis.exactNormalizedGroups.length}`,
    `- Near duplicate groups: ${result.duplicateAnalysis.nearDuplicateGroups.length}`,
    "",
    "### Exact Duplicate Groups (Normalized)",
    "",
    exactGroupsPreview || "- none",
    "",
    "### Near-Duplicate Groups",
    "",
    nearGroupsPreview || "- none",
    "",
    "## Unique vs Repeated Content",
    "",
    `- Naive average score: ${result.scoreInterpretation.naiveAvgScore}`,
    `- Unique-raw weighted average score: ${result.scoreInterpretation.uniqueRawAvgScore}`,
    `- Unique-normalized weighted average score: ${result.scoreInterpretation.uniqueNormalizedAvgScore}`,
    "",
    "| Category | Unique Representatives | Unique-Only Avg Score |",
    "|---|---:|---:|",
    uniqueCategoryRows,
    "",
    "## Low-Diversity Categories",
    "",
    lowDiversity,
    "",
    "| Category | Total Docs | Unique Raw | Unique Normalized | Duplicate Docs | Duplicate Rate | Near-Duplicate Docs | Near-Duplicate Rate | Low Diversity |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---|",
    dupCategoryRows,
    "",
    "## Benchmark Reliability Notes",
    "",
    reliabilityNotes,
    "",
    "### Reliability Warnings",
    "",
    dupWarnings,
    "",
    "## Recurring Risk Patterns",
    "",
    recurring || "- none",
    "",
  ].join("\n");
}

function markdownSuspicious(result: BenchmarkRunResult): string {
  const docs = result.docs;
  const suspicious = docs
    .filter((d) => d.score.finalScore < 60 || d.risks.some((r) => r.severity === "error") || d.risks.length >= 4)
    .sort((a, b) => a.score.finalScore - b.score.finalScore);

  const sections: string[] = ["# Suspicious Cases", ""];
  if (suspicious.length === 0) {
    sections.push("No suspicious cases detected.");
    sections.push("");
  } else {
    for (const doc of suspicious) {
      sections.push(`## ${doc.docId} (${doc.category}) - score ${doc.score.finalScore}`);
      sections.push(`Path: \`${doc.relativePath}\``);
      sections.push("");
      sections.push("Risks:");
      if (doc.risks.length === 0) {
        sections.push("- none (flagged by low score threshold)");
      } else {
        for (const risk of doc.risks) {
          sections.push(`- [${risk.severity}] \`${risk.code}\` - ${risk.message}`);
        }
      }
      sections.push("");
    }
  }

  const dup = result.duplicateAnalysis.summary;
  sections.push("## Duplicate Analysis");
  sections.push("");
  sections.push(`- Total docs: ${dup.totalDocs}`);
  sections.push(`- Unique normalized docs: ${dup.uniqueNormalizedDocs}`);
  sections.push(`- Duplicate rate: ${dup.duplicateRate}`);
  sections.push(
    `- Exact normalized duplicate groups: ${result.duplicateAnalysis.exactNormalizedGroups.length}`,
  );
  sections.push(`- Near duplicate groups: ${result.duplicateAnalysis.nearDuplicateGroups.length}`);
  const exactPreview = result.duplicateAnalysis.exactNormalizedGroups
    .slice(0, 5)
    .map((g) => `- ${g.representative.relativePath} (+${g.members.length - 1} duplicates)`);
  const nearPreview = result.duplicateAnalysis.nearDuplicateGroups
    .slice(0, 5)
    .map(
      (g) =>
        `- ${g.representative.relativePath} (+${g.members.length - 1} near-duplicates, similarity ${g.similarity ?? NEAR_DUPLICATE_THRESHOLD})`,
    );
  if (exactPreview.length > 0) {
    sections.push("- Top exact normalized groups:");
    sections.push(...exactPreview);
  }
  if (nearPreview.length > 0) {
    sections.push("- Top near-duplicate groups:");
    sections.push(...nearPreview);
  }
  sections.push("");
  sections.push("## Low-Diversity Categories");
  sections.push("");
  if (dup.lowDiversityCategories.length === 0) {
    sections.push("- none");
  } else {
    for (const category of dup.lowDiversityCategories) {
      const cat = dup.perCategory.find((x) => x.category === category);
      if (!cat) continue;
      sections.push(
        `- ${category}: ${cat.totalDocs} docs, ${cat.uniqueNormalizedDocs} unique normalized, duplicate rate ${cat.duplicateRate}, near-duplicate rate ${cat.nearDuplicateRate}`,
      );
    }
  }
  sections.push("");
  sections.push("## Benchmark Reliability Notes");
  sections.push("");
  if (result.duplicateAnalysis.reliabilityNotes.length === 0) {
    sections.push("- none");
  } else {
    for (const note of result.duplicateAnalysis.reliabilityNotes) {
      sections.push(`- ${note}`);
    }
  }

  return sections.join("\n");
}

async function evaluateDoc(entry: DocEntry, inferSemanticHeadings: boolean): Promise<EvaluatedDoc> {
  const rawText = await fs.readFile(entry.absPath, "utf8");
  const { normalizedText, notes, stats } = normalizeInput(rawText, {
    inferSemanticHeadings,
  });
  const similarityProfile = buildSimilarityProfile(normalizedText);

  const parsed = await parseMarkdownToHtml(normalizedText, {
    includeToc: true,
    tocMaxDepth: 3,
  });

  const diagnostics = extractDocDiagnostics({
    rawText,
    normalizedText,
    notes,
    stats,
    renderedHtml: parsed.html,
    headings: parsed.headings,
    intelligence: parsed.intelligence,
  });

  const hierarchy = parsed.intelligence.hierarchy ?? [];
  const headings = parsed.headings;
  const sectionCount = hierarchy.filter((n) => n.role === "section").length;
  const subsectionCount = hierarchy.filter((n) => n.role === "subsection").length;
  const subtitleCount = hierarchy.filter((n) => n.role === "subtitle").length;
  const entityCount = hierarchy.filter((n) => n.role === "entity").length;

  let procedureLabelCount = 0;
  for (const node of hierarchy.filter((n) => n.role === "label")) {
    if (PROCEDURE_LABEL_PATTERN.test(node.text.trim().replace(/:$/, ""))) {
      procedureLabelCount++;
    }
  }
  for (const p of parsed.intelligence.procedures) {
    if (PROCEDURE_LABEL_PATTERN.test(p.title.trim().replace(/:$/, ""))) {
      procedureLabelCount++;
    }
  }

  const wordCount = countWords(normalizedText);
  const paragraphCount = estimateParagraphCount(normalizedText);
  const sentenceLikeHeadingCount = countSentenceLikeHeadings(headings);
  const headingToParagraphRatio = headings.length / Math.max(1, paragraphCount);
  const phaseLikeCount = Math.max(
    parsed.intelligence.roadmaps.filter((r) => r.kind === "phase").length,
    (normalizedText.match(/(?:^|\n)\s*(?:#{1,6}\s+)?Phase\s+\d+/gim) ?? []).length,
  );

  const tableSignals = tableCorruptionSignals(normalizedText);

  const weakHierarchySignalCount =
    (headings.length === 0 ? 1 : 0) +
    (sectionCount === 0 ? 1 : 0) +
    (hierarchy.length < 2 ? 1 : 0);

  const metrics: BenchmarkMetrics = {
    wordCount,
    paragraphCount,
    headingCount: headings.length,
    sectionCount,
    subsectionCount,
    subtitleCount,
    entityCount,
    procedureLabelCount,
    tableCount: parsed.intelligence.tables.length,
    codeBlockCount: parsed.intelligence.stats.codeBlocks,
    commandBlockCount: parsed.intelligence.stats.commandBlocks,
    diagramCount: parsed.intelligence.diagrams.length,
    calloutCount: parsed.intelligence.callouts.length,
    phaseLikeCount,
    headingToParagraphRatio: round2(headingToParagraphRatio),
    sentenceLikeHeadingCount,
    tablePipeNoiseCount: tableSignals.pipeNoise,
    truncatedTableRowCount: tableSignals.truncatedRows,
    tableMergeRiskCount: tableSignals.mergeRisk,
    weakHierarchySignalCount,
  };

  const risks: BenchmarkRisk[] = [];

  if (metrics.headingCount > Math.max(30, metrics.paragraphCount * 1.2)) {
    addRisk(risks, "heading_explosion", "warning", "Suspicious heading explosion detected", metrics.headingCount);
  }
  if (metrics.headingToParagraphRatio > 0.9 && metrics.headingCount > 10) {
    addRisk(risks, "heading_density_high", "warning", "Heading density is unusually high", metrics.headingToParagraphRatio);
  }
  if (metrics.sentenceLikeHeadingCount > 0) {
    addRisk(
      risks,
      "sentence_like_headings",
      "warning",
      "Sentence-like headings detected (potential false heading promotions)",
      metrics.sentenceLikeHeadingCount,
    );
  }
  if (metrics.tablePipeNoiseCount >= 4 && metrics.tableCount === 0) {
    addRisk(risks, "table_noise_without_tables", "warning", "Pipe-heavy content detected with no parsed tables");
  }
  if (metrics.truncatedTableRowCount > 0) {
    addRisk(risks, "truncated_table_rows", "warning", "Truncated table rows detected", metrics.truncatedTableRowCount);
  }
  if (metrics.tableMergeRiskCount > 0) {
    addRisk(risks, "table_merge_risk", "warning", "Potential table/prose merge risk detected", metrics.tableMergeRiskCount);
  }
  if (metrics.weakHierarchySignalCount >= 2) {
    addRisk(risks, "weak_hierarchy", "warning", "Hierarchy appears weak for this document");
  }
  if ((entry.category === "technical" || entry.category === "mixed") && metrics.wordCount > 250 && metrics.entityCount === 0) {
    addRisk(risks, "entity_under_detection", "warning", "Entity-rich document produced zero entities");
  }
  if (entry.category === "roadmaps" && metrics.phaseLikeCount === 0) {
    addRisk(risks, "roadmap_zero_phase", "error", "Roadmap-like document produced zero phase-like structure");
  }
  if ((entry.category === "tutorials" || entry.category === "sop") && metrics.procedureLabelCount === 0) {
    addRisk(risks, "procedure_labels_missing", "error", "Expected procedure/checklist labels were not detected");
  }

  const categoryEval = evaluateCategory(entry.category, metrics, normalizedText, headings);
  risks.push(...categoryEval.risks);

  const headingHierarchyIssueCount = diagnostics.items.filter(
    (i) => i.kind === "heading_hierarchy_issue",
  ).length;

  const score: ScoreBreakdown = computeScores(
    entry.category,
    metrics,
    risks.length,
    categoryEval.score01,
    headingHierarchyIssueCount,
  );

  const result: BenchmarkDocResult = {
    docId: entry.docId,
    category: entry.category,
    fileName: entry.fileName,
    relativePath: entry.relativePath,
    fingerprints: {
      rawHash: sha256(rawText),
      normalizedHash: sha256(normalizedText),
      similarityHash: sha256(similarityProfile.canonicalLines.join("\n")),
      canonicalLineCount: similarityProfile.canonicalLineSet.size,
      canonicalTokenCount: similarityProfile.canonicalTokenSet.size,
    },
    structures: {
      normalizationNotes: notes,
      normalizationStats: stats,
      parsedHeadings: parsed.headings,
      intelligence: parsed.intelligence,
    },
    metrics,
    risks,
    diagnostics: {
      info: diagnostics.summary.info,
      warning: diagnostics.summary.warning,
      error: diagnostics.summary.error,
      items: diagnostics.items.map((i) => ({
        kind: i.kind,
        severity: i.severity,
        message: i.message,
        detail: i.detail,
      })),
    },
    score,
  };

  return {
    result,
    similarityProfile,
  };
}

function summarizeByCategory(results: BenchmarkDocResult[]): CategorySummary[] {
  return CATEGORY_ORDER.map((category) => {
    const docs = results.filter((r) => r.category === category);
    const scores = docs.map((d) => d.score.finalScore);
    return {
      category,
      count: docs.length,
      avgScore: round2(mean(scores)),
      minScore: docs.length ? Math.min(...scores) : 0,
      maxScore: docs.length ? Math.max(...scores) : 0,
      avgHeadings: round2(mean(docs.map((d) => d.metrics.headingCount))),
      avgEntities: round2(mean(docs.map((d) => d.metrics.entityCount))),
      avgTables: round2(mean(docs.map((d) => d.metrics.tableCount))),
      riskCount: docs.reduce((acc, d) => acc + d.risks.length, 0),
    };
  });
}

async function writePerDocResults(outputRoot: string, docs: BenchmarkDocResult[]) {
  const perDocDir = path.join(outputRoot, "per_doc");
  await fs.mkdir(perDocDir, { recursive: true });
  for (const doc of docs) {
    const file = `${doc.category}_${doc.docId}.json`;
    await fs.writeFile(
      path.join(perDocDir, file),
      JSON.stringify(doc, null, 2),
      "utf8",
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const docsRoot = path.resolve(process.cwd(), parseArg(args, "--docs") ?? "benchmark_docs");
  const outputRoot = path.resolve(process.cwd(), parseArg(args, "--out") ?? "benchmark_results");
  const inferSemanticHeadings = args.includes("--infer-semantic-headings");

  const docs = await listBenchmarkDocs(docsRoot);
  if (docs.length === 0) {
    throw new Error(`No benchmark documents found under ${docsRoot}`);
  }

  await fs.mkdir(outputRoot, { recursive: true });

  const results: BenchmarkDocResult[] = [];
  const similarityProfiles: SimilarityProfile[] = [];
  for (const doc of docs) {
    // Sequential execution keeps memory and Shiki overhead predictable.
    const evaluated = await evaluateDoc(doc, inferSemanticHeadings);
    results.push(evaluated.result);
    similarityProfiles.push(evaluated.similarityProfile);
  }

  const categorySummaries = summarizeByCategory(results);
  const avgScore = round2(mean(results.map((r) => r.score.finalScore)));
  const scoreInterpretation = buildScoreInterpretation(results, avgScore);
  const duplicateAnalysis = buildDuplicateAnalysis(
    results,
    similarityProfiles,
    scoreInterpretation,
  );

  const recurringMap = new Map<string, number>();
  for (const doc of results) {
    for (const risk of doc.risks) {
      recurringMap.set(risk.code, (recurringMap.get(risk.code) ?? 0) + 1);
    }
  }
  const recurringRiskPatterns = Array.from(recurringMap.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  const sorted = [...results].sort((a, b) => b.score.finalScore - a.score.finalScore);
  const top10 = sorted.slice(0, 10).map((d) => ({
    docId: d.docId,
    category: d.category,
    score: d.score.finalScore,
    relativePath: d.relativePath,
  }));
  const worst10 = [...sorted]
    .reverse()
    .slice(0, 10)
    .map((d) => ({
      docId: d.docId,
      category: d.category,
      score: d.score.finalScore,
      relativePath: d.relativePath,
    }));

  const runResult: BenchmarkRunResult = {
    generatedAt: new Date().toISOString(),
    docsRoot,
    outputRoot,
    totalDocs: results.length,
    avgScore,
    categorySummaries,
    duplicateAnalysis,
    scoreInterpretation,
    recurringRiskPatterns,
    top10,
    worst10,
    docs: results,
  };

  await writePerDocResults(outputRoot, results);
  await fs.writeFile(
    path.join(outputRoot, "results.json"),
    JSON.stringify(runResult, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(outputRoot, "summary.md"),
    markdownSummary(runResult),
    "utf8",
  );
  await fs.writeFile(
    path.join(outputRoot, "suspicious_cases.md"),
    markdownSuspicious(runResult),
    "utf8",
  );

  console.log(`Benchmark complete: ${results.length} docs`);
  console.log(`Average score: ${avgScore}`);
  console.log(`Results written to: ${outputRoot}`);
}

main().catch((err) => {
  console.error("Benchmark run failed:");
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
