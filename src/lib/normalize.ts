import type { NormalizeOptions, NormalizeResult, NormalizeStats } from "./docModel";

const MERMAID_HINTS = [
  "graph TD",
  "graph LR",
  "sequenceDiagram",
  "flowchart",
  "stateDiagram",
  "classDiagram",
  "erDiagram",
  "journey",
  "gantt",
];

function isFenceOpenLine(line: string): string | null {
  // opening fence: ```lang (lang optional)
  const m = line.match(/^\s*```([\w-]+)?\s*$/);
  if (!m) return null;
  return (m[1] ?? "").trim();
}

function isFenceCloseLine(line: string): boolean {
  // closing fence must be ONLY ```
  return /^\s*```\s*$/.test(line);
}

function isFenceLine(line: string): boolean {
  return isFenceOpenLine(line) !== null || isFenceCloseLine(line);
}

function escapeBackticksInCodeLine(line: string): string {
  // Neutralize BOL triple-backtick inside code so it cannot end the fence.
  return line.replace(/^(\s*)```/g, "$1\\`\\`\\`");
}

function looksLikeCodeLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  return (
    /^(\#|\/\/|;|\/\*|\*|\}|{|return\b|const\b|let\b|def\b|class\b|import\b|from\b)/.test(
      s,
    ) || /^\s{2,}\S+/.test(line)
  );
}

function looksLikeCodeStart(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  if (/^function\s+TEXT\b/i.test(s)) return false;
  return (
    /^\/\//.test(s) ||
    /^#/.test(s) ||
    /^(function\b|const\b|let\b|var\b|class\b|interface\b|type\b|import\b|export\b|def\b|from\b|if\b|for\b|while\b|try\b|switch\b)/.test(
      s,
    ) ||
    /^[@\w$]+\s*=\s*.+/.test(s) ||
    /[;{}]$/.test(s) ||
    /=>/.test(s)
  );
}

function looksLikeCodeLineGeneric(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  return (
    looksLikeCodeLine(line) ||
    /^[@\w$.[\]()]+\s*[:=]\s*.+/.test(s) ||
    /^[)\]}]+[,;]?$/.test(s) ||
    /^<[\w/-]+>/.test(s) ||
    /[;{}]$/.test(s) ||
    /=>/.test(s)
  );
}

function guessCodeLang(lines: string[]): string {
  const text = lines.join("\n");

  if (/^\s*[{[]/.test(lines[0] ?? "") && /"\w+"\s*:/.test(text)) return "json";
  if (
    /\b(CREATE TABLE|PRIMARY KEY|INTEGER|TEXT|REAL|SELECT COUNT\(\*\)|CREATE INDEX)\b/i.test(
      text,
    )
  ) {
    return "sql";
  }
  if (
    lines.some((line) =>
      /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source|cp|mv|rm|sudo|htop|vcgencmd|\.quit|\.mode|\.import)\b/.test(
        line.trim(),
      ),
    )
  ) {
    return "bash";
  }
  if (/\b(def|import|from|class)\b/.test(text) && !/[;{}]/.test(text))
    return "python";
  if (
    /\b(function|const|let|var|import|export|return)\b/.test(text) ||
    /=>/.test(text)
  ) {
    return "javascript";
  }
  if (/^(PS [A-Z]:\\|[A-Z]:\\.*>|Get-|Set-|New-|Write-)/m.test(text)) {
    return "powershell";
  }
  if (/^(npm|pnpm|yarn|docker|git|curl|wget|\$ |#!\/bin\/(?:ba)?sh)/m.test(text))
    return "bash";

  return "text";
}

function splitColumnsBySpacing(line: string): string[] {
  return line
    .trim()
    .split(/(?:\t+| {2,})/g)
    .map((c) => c.trim())
    .filter(Boolean);
}

function splitColumnsByPipes(line: string): string[] {
  if (!line.includes("|")) return [];
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function looksLikeSeparatorRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

function toMarkdownTable(rows: string[][]): string[] {
  const header = rows[0];
  const colCount = header.length;

  const norm = rows.map((row) => {
    const normalized = row.slice(0, colCount);
    while (normalized.length < colCount) normalized.push("");
    return normalized;
  });

  const headerLine = `| ${norm[0].join(" | ")} |`;
  const sepLine = `| ${new Array(colCount).fill("---").join(" | ")} |`;
  const bodyLines = norm.slice(1).map((row) => `| ${row.join(" | ")} |`);

  return [headerLine, sepLine, ...bodyLines];
}

function appendToLastCell(rows: string[][], extraLine: string) {
  if (rows.length < 2) return;
  const lastRow = rows[rows.length - 1];
  if (!lastRow || lastRow.length === 0) return;
  const idx = lastRow.length - 1;
  lastRow[idx] = `${lastRow[idx] ?? ""} ${extraLine.trim()}`.trim();
}

function padRow(row: string[], colCount: number): string[] {
  const r = row.slice(0, colCount);
  while (r.length < colCount) r.push("");
  return r;
}

function isBlockBoundary(line: string): boolean {
  return (
    /^\s*#{1,6}\s+/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*---+\s*$/.test(line) ||
    isFenceOpenLine(line) !== null
  );
}

function isMarkdownHeading(line: string): boolean {
  return /^\s*#{1,6}\s+/.test(line);
}

function isNumberHeading(line: string): boolean {
  return /^\s*\d+(?:\.\d+)*\s+/.test(line);
}

function isLikelyNumberedSectionTitle(line: string): boolean {
  const s = line.trim();

  if (!s) return false;
  if (!/^\d+[.)]\s+/.test(s)) return false;
  if (isLikelyCommand(s)) return false;
  if (looksLikeCodeStart(s) || looksLikeCodeLineGeneric(s)) return false;
  if (isLikelyTableLike(s)) return false;
  if (isLikelyDiagramLike(s)) return false;

  const body = s.replace(/^\d+[.)]\s+/, "").trim();
  if (!body) return false;
  if (body.length > 90) return false;
  if (/^[a-z]/.test(body)) return false;

  return true;
}

function isStrongBoundary(line: string): boolean {
  // Do NOT include "# " because it appears in bash/python comments.
  return (
    /^\s*#{2,6}\s+/.test(line) ||
    /^\s*\d+\.\d+/.test(line) ||
    /^\s*\d+(?:\.\d+)*\)\s+/.test(line) ||
    /^\s*(Section|Subsection):\s+/i.test(line)
  );
}

function fenceHasLanguage(openFenceLine: string): boolean {
  // ```bash / ```ts / ```python etc.
  return /^\s*```[\w-]+\s*$/.test(openFenceLine);
}

function isBlockquote(line: string): boolean {
  return /^\s*>/.test(line);
}

function isSeparator(line: string): boolean {
  return /^\s*---+\s*$/.test(line);
}

function looksAsciiDiagram(line: string): boolean {
  return /^[+|\- ]{5,}/.test(line);
}

function isAsciiLine(line: string): boolean {
  const s = line.trim();
  return /^[+\-| ]{3,}/.test(s) || /^\|/.test(s);
}

function isListLine(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
}

function detectTableHeader(line: string): { mode: "spacing" | "pipes"; cols: string[] } | null {
  if (looksLikeSectionTitle(line)) {
    return null;
  }

  const pipes = splitColumnsByPipes(line);
  if (pipes.length >= 2) return { mode: "pipes", cols: pipes };

  const spacing = splitColumnsBySpacing(line);
  if (spacing.length >= 2) return { mode: "spacing", cols: spacing };

  // Fallback: 3+ space-separated tokens can still be a table header.
  const fallback = line.trim().split(/\s{1,}/);
  if (fallback.length >= 3) return { mode: "spacing", cols: fallback };

  return null;
}

function isLikelyCommand(line: string): boolean {
  const s = line.trim();
  if (!s) return false;

  if (/^\$ /.test(s)) return true;
  if (/^PS [A-Z]:\\/.test(s)) return true;
  if (/^[A-Z]:\\.*>/.test(s)) return true;

  return (
    /^(npm|pnpm|yarn)\s+/.test(s) ||
    /^(pip|pip3|python|python3|uvicorn|gunicorn|streamlit|sqlite3)\s+/.test(s) ||
    /^(docker|docker-compose)\s+/.test(s) ||
    /^git\s+/.test(s) ||
    /^(curl|wget)\s+/.test(s) ||
    /^(mkdir|cd|touch|chmod|chown|cp|mv|rm|ls|cat|echo|source|export)\s+/.test(s) ||
    /^(apt|apt-get)\s+/.test(s) ||
    /^sudo\s+/.test(s)
  );
}

function isCommandsLabel(line: string): boolean {
  return /^\s*(Commands|Command|CLI|Terminal)\s*:\s*$/i.test(line.trim());
}

function detectCommandLang(lines: string[]): "powershell" | "bash" {
  for (const l of lines) {
    const s = l.trim();
    if (/^PS [A-Z]:\\/.test(s) || /^[A-Z]:\\.*>/.test(s)) return "powershell";
  }
  return "bash";
}

function isListItem(line: string): boolean {
  return /^\s*(?:[-+*]|\d+\.)\s+/.test(line);
}

function looksLikeSectionTitle(line: string): boolean {
  const raw = line.trim();
  if (!raw) return false;
  const s = raw
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/, "")
    .replace(/^["'“”‘’]+/, "")
    .trim();
  if (!s) return false;

  const patterns = [
    /^project goal\b/i,
    /^project overview\b/i,
    /^core concept\b/i,
    /^functional workflow\b/i,
    /^key features\b/i,
    /^hardware platform\b/i,
    /^hardware cost estimate\b/i,
    /^software architecture\b/i,
    /^database structure\b/i,
    /^development roadmap\b/i,
    /^system flowcharts\b/i,
    /^electronics required\b/i,
    /^estimates?\b/i,
    /^warnings?\s*&\s*alerts?\b/i,
    /^system alerts?\s*&\s*warnings?\b/i,
    /^project objective\b/i,
    /^v1 roadmap\b/i,
  ];

  return patterns.some((p) => p.test(s));
}

function isLikelySetupLabel(line: string): boolean {
  const s = line.trim();
  const label = s.replace(/[.:;!?]+$/, "").trim();

  if (!label) return false;
  if (label.length > 72) return false;
  if (!/^[A-Z]/.test(label)) return false;
  if (isLikelyCommand(label)) return false;
  if (looksLikeCodeStart(label) || looksLikeCodeLineGeneric(label)) return false;
  if (isLikelyTableLike(label) || isLikelyDiagramLike(label)) return false;

  return /(?:Create|Install|Run|Verify|Load|Save|Activate|Initialize|Add|Make|Backup|Monitor|Check|Access|Exit|Place|Resulting|Expected|Contents|Update|Example|Inside|Outputs)/.test(
    label,
  );
}

function isLikelySqlLike(line: string): boolean {
  const s = line.trim();
  if (!s) return false;

  return (
    /^(CREATE|ALTER|DROP|INSERT|DELETE|SELECT|WITH|PRAGMA)\b/i.test(s) ||
    /^UPDATE\s+.+\s+SET\b/i.test(s)
  );
}

function nextNonBlankLine(lines: string[], start: number): string {
  for (let i = start; i < lines.length; i++) {
    const s = lines[i]?.trim() ?? "";
    if (s) return lines[i] ?? "";
  }
  return "";
}

function prevNonBlankLine(lines: string[], start: number): string {
  for (let i = start; i >= 0; i--) {
    const s = lines[i]?.trim() ?? "";
    if (s) return lines[i] ?? "";
  }
  return "";
}

function isTitleCaseLike(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  return words.every((w) => {
    if (/^[A-Z0-9][A-Z0-9\-\u2013()&/]*$/.test(w)) return true;
    return /^[A-Z][a-z0-9\-\u2013()&/]*$/.test(w);
  });
}

function isUppercaseLike(line: string): boolean {
  const s = line.trim();
  return /^[A-Z0-9\s\-\u2013()&/]+$/.test(s) && /[A-Z]/.test(s);
}

function isLikelyTableLike(line: string): boolean {
  return splitColumnsBySpacing(line).length >= 2 || splitColumnsByPipes(line).length >= 2;
}

function isLikelyDiagramLike(line: string): boolean {
  const s = line.trim();
  return (
    looksAsciiDiagram(line) ||
    /^(graph TD|graph LR|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt)\b/.test(
      s,
    ) ||
    /[\u2193\u2192\u2190\u2191]/.test(s)
  );
}

function isLikelyProcedureLabel(line: string): boolean {
  return /^(Steps|Workflow|Procedure|Checklist|Validation|Run)\s*:?$/i.test(line.trim());
}

function stripSimpleListMarker(line: string): string {
  return line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+(?:[.)])\s+/, "")
    .trim();
}

function stripHeadingPrefix(line: string): string {
  return line.trim().replace(/^#{1,6}\s+/, "").trim();
}

function normalizeEntityAnchorText(line: string): string {
  return stripHeadingPrefix(line)
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/, "")
    .replace(/[:.]+$/, "")
    .trim();
}

function looksLikeEntityListAnchor(line: string): boolean {
  const anchor = normalizeEntityAnchorText(line);
  if (!anchor || anchor.length > 72) return false;
  if (isLikelyCommand(anchor)) return false;
  if (looksLikeCodeStart(anchor) || looksLikeCodeLineGeneric(anchor)) return false;
  if (isLikelyTableLike(anchor) || isLikelyDiagramLike(anchor)) return false;

  if (
    /^(?:core|key|main|primary|system|hardware|software)\s+(?:components?|modules?|entities?|subsystems?|services?|units?|layers?)$/i.test(
      anchor,
    )
  ) {
    return true;
  }

  if (/^(?:components?|modules?|entities?|subsystems?|services?|units?|layers?)$/i.test(anchor)) {
    return true;
  }

  return /^(?:the\s+)?(?:system|platform|architecture)\s+(?:includes?|contains?|integrates?)$/i.test(
    anchor,
  );
}

function looksLikeEntityListItem(line: string): boolean {
  const s = stripSimpleListMarker(stripHeadingPrefix(line));
  if (!s) return false;
  if (s.length > 50) return false;
  if (/[.:;!?]$/.test(s)) return false;
  if (isLikelyProcedureLabel(s)) return false;
  if (/^(?:phase|stage|step|part)\s+\d+/i.test(s)) return false;
  if (/^\d+(?:\.\d+)*$/.test(s)) return false;
  if (isLikelyCommand(s)) return false;
  if (looksLikeCodeStart(s) || looksLikeCodeLineGeneric(s)) return false;
  if (isLikelyTableLike(s) || isLikelyDiagramLike(s)) return false;
  if (
    /\b(should|must|will|can|could|would|may|might|is|are|was|were|include|includes|integrates|contains)\b/i.test(
      s,
    )
  ) {
    return false;
  }

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;

  if (looksLikeTechnicalEntityLine(s)) return true;
  if (isTitleCaseLike(s) || isUppercaseLike(s)) return true;

  return /^[A-Za-z0-9][A-Za-z0-9/&()+\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9/&()+\-]*){0,4}$/.test(
    s,
  );
}

function getEntityListRunAfterAnchor(
  lines: string[],
  anchorIndex: number,
): { count: number; lastIndex: number } {
  let count = 0;
  let lastIndex = -1;
  let blankRun = 0;

  for (let i = anchorIndex + 1; i < lines.length && i <= anchorIndex + 14; i++) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();

    if (!trimmed) {
      blankRun++;
      if (blankRun > 2 && count > 0) break;
      continue;
    }
    blankRun = 0;

    if (
      isMarkdownHeading(raw) ||
      isNumberHeading(raw) ||
      isSeparator(raw) ||
      isFenceOpenLine(raw) !== null ||
      isLikelyTableLike(raw) ||
      isLikelyDiagramLike(raw) ||
      isLikelyCommand(raw)
    ) {
      break;
    }

    if (looksLikeEntityListItem(raw)) {
      count++;
      lastIndex = i;
      continue;
    }

    break;
  }

  return { count, lastIndex };
}

function isEntityListContextLine(lines: string[], index: number): boolean {
  const current = lines[index] ?? "";
  if (!looksLikeEntityListItem(current)) return false;

  for (let j = index - 1; j >= 0 && index - j <= 12; j--) {
    const candidate = lines[j] ?? "";
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    if (looksLikeEntityListAnchor(candidate)) {
      const run = getEntityListRunAfterAnchor(lines, j);
      return run.count >= 2 && run.lastIndex >= index;
    }

    if (looksLikeEntityListItem(candidate)) continue;

    if (
      isMarkdownHeading(candidate) ||
      isNumberHeading(candidate) ||
      isFenceOpenLine(candidate) !== null ||
      isLikelyTableLike(candidate) ||
      isLikelyDiagramLike(candidate) ||
      /[.?!]$/.test(stripHeadingPrefix(candidate))
    ) {
      break;
    }

    break;
  }

  return false;
}

function shouldDemoteEntityHeadingInContext(lines: string[], index: number, line: string): boolean {
  const match = line.match(/^\s*(#{2,6})\s+(.+?)\s*$/);
  if (!match) return false;
  const headingText = match[2]?.trim() ?? "";
  if (!headingText) return false;
  if (/[.:;!?]$/.test(headingText)) return false;
  if (headingText.length > 50) return false;
  if (!looksLikeEntityListItem(headingText)) return false;

  const probe = [...lines];
  probe[index] = headingText;
  return isEntityListContextLine(probe, index);
}

function isLikelyInstructionLabel(line: string, nextNonBlank: string): boolean {
  const s = line.trim();
  if (!s) return false;

  const imperativeLike =
    /^[A-Z][a-z]+(?:\s+[a-z][a-z0-9\-()]*){0,5}$/.test(s) && !/[.:;!?]$/.test(s);
  if (!imperativeLike) return false;

  return (
    isLikelyCommand(nextNonBlank) ||
    looksLikeCodeStart(nextNonBlank) ||
    looksLikeCodeLineGeneric(nextNonBlank) ||
    /^(touch|mkdir|cd|chmod|source|sqlite3|python3|pip|streamlit|sudo)\b/.test(
      nextNonBlank.trim(),
    ) ||
    /^[\u251C\u2514\u2502]/.test(nextNonBlank.trim())
  );
}

function looksLikeTechnicalEntityLine(text: string): boolean {
  const s = text.trim();
  if (!s) return false;

  return (
    /^(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Engine|Module|Sensor|Valve|Probe|Camera|Reservoir|Cartridge|Channel|Layer|Subsystem))$/.test(
      s,
    ) ||
    /^[A-Z][a-z]+(?:\/[A-Z]?[a-z]+)+$/.test(s)
  );
}

function nextLooksLikeCommandBlock(next: string): boolean {
  const s = next.trim();
  if (!s) return false;

  return (
    isLikelyCommand(s) ||
    looksLikeCodeStart(s) ||
    looksLikeCodeLineGeneric(s) ||
    /^[a-z0-9_-]+\s+[a-z]/.test(s) ||
    /^[a-z0-9_-]+\s+-/.test(s) ||
    /^[A-Za-z0-9_-]+\s+--/.test(s) ||
    /^\$/.test(s)
  );
}

function isLikelySemanticHeadingLine(line: string, nextNonBlank = ""): boolean {
  const s = line.trim();
  if (!s) return false;
  // block sentence-like lines ending with ":" that contain verbs
  if (/:$/.test(s) && /\b(should|must|will|can|could|would|may|might|is|are|was|were)\b/i.test(s)) {
    return false;
  }
  if (s.length > 72) return false;
  // imperative step labels are usually not section headings
  if (/^(Update|Install|Create|Run|Verify|Check|Backup|Monitor|Save|Load|Access|Activate)\b/i.test(s)) {
    return false;
  }
  // block labels followed by commands
  if (isLikelyCommand(nextNonBlank)) {
    return false;
  }
  if (/^(ALERT|WARNING|NOTE|TIP)\s*:/i.test(s)) return false;
  if (/^(Recommended|Notes|Alerts|Warnings)$/i.test(s)) return false;
  if (/^\d+(?:\.\d+)*\s+/.test(s)) return false;
  if (/^\d+\.\s+/.test(s)) return false;
  if (/^[-*+]\s+/.test(s)) return false;
  if (isLikelyProcedureLabel(s)) return false;
  if (isLikelyCommand(s)) return false;
  if (looksLikeCodeStart(s) || looksLikeCodeLineGeneric(s)) return false;
  if (isLikelyTableLike(s)) return false;
  if (isLikelyDiagramLike(s)) return false;

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 6) return false;
  return isTitleCaseLike(s) || isUppercaseLike(s);
}

function shouldPromoteSemanticHeading(
  line: string,
  prev: string,
  next: string,
  nextNonBlank: string,
): boolean {
  if (/^\d+[.)]\s+/.test(line.trim())) return false;
  const trimmed = line.trim();

  // block sentence-like colon lines before section-title heuristics can override
  if (
    /:$/.test(trimmed) &&
    /\b(should|must|will|can|could|would|may|might|is|are|was|were)\b/i.test(trimmed)
  ) {
    return false;
  }

  const sectionTitleLike = looksLikeSectionTitle(line);
  const semanticLike = isLikelySemanticHeadingLine(line, nextNonBlank) || sectionTitleLike;
  if (!semanticLike) return false;
  if (!sectionTitleLike && prev.trim() !== "") return false;

  const nextStartsStructuredBlock =
    next.trim() === "" ||
    isLikelyTableLike(next) ||
    isFenceOpenLine(next) !== null ||
    isLikelyCommand(nextNonBlank) ||
    looksLikeCodeStart(nextNonBlank) ||
    looksLikeCodeLineGeneric(nextNonBlank);
  if (!nextStartsStructuredBlock) return false;
  if (nextLooksLikeCommandBlock(nextNonBlank)) return false;
  if (isLikelyInstructionLabel(line, nextNonBlank)) return false;
  return true;
}

function isSemanticBoundary(
  lines: string[],
  index: number,
): boolean {
  const line = lines[index] ?? "";

  if (
    isMarkdownHeading(line) ||
    isNumberHeading(line) ||
    isSeparator(line) ||
    isBlockquote(line)
  ) {
    return true;
  }

  if (isFenceOpenLine(line) !== null) return true;

  if (isLikelySemanticHeadingLine(line)) {
    return true;
  }

  return false;
}

/**
 * Phase 4/7: deterministic Smart Normalizer.
 */
export function normalizeInput(
  rawText: string,
  options: NormalizeOptions = {},
): NormalizeResult {
  const notes: string[] = [];
  const stats: NormalizeStats = {
    fencesAutoClosed: 0,
    headingsFixed: 0,
    bulletsNormalized: 0,
    numberingNormalized: 0,
    commandBlocksCreated: 0,
    mermaidBlocksCreated: 0,
    tablesConverted: 0,
  };
  const inferSemanticHeadings = options.inferSemanticHeadings ?? false;

  // 0) Normalize line endings + trim trailing whitespace.
  const text = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");
  const lines = text.split("\n");

  // 1) Heading + bullet/number normalization.
  const out1: string[] = [];
  let semanticTitleAssigned = false;
  let inFence0 = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] ?? "";

    if (inFence0) {
      out1.push(line);
      if (isFenceCloseLine(line)) inFence0 = false;
      continue;
    }

    const openFenceLang = isFenceOpenLine(line);
    if (openFenceLang !== null) {
      inFence0 = true;
      out1.push(line);
      continue;
    }

    if (/^helixia pro$/i.test(line.trim())) {
      continue;
    }

    // Preserve shell-style comments as text when they introduce command/code blocks.
    if (/^\s*#\s+/.test(line)) {
      const nextNonBlank = nextNonBlankLine(lines, i + 1);
      if (nextLooksLikeCommandBlock(nextNonBlank)) {
        line = line.replace(/^(\s*)#\s+/, "$1\\# ");
        out1.push(line);
        continue;
      }

      // Treat "# ..." as heading only when separated by a blank line.
      const prev = (lines[i - 1] ?? "").trim();
      if (prev !== "") {
        out1.push(line);
        continue;
      }
    }

    const preserveListLine =
      isListLine(line) &&
      !(inferSemanticHeadings && isLikelyNumberedSectionTitle(line));

    if (
      isMarkdownHeading(line) ||
      isNumberHeading(line) ||
      isBlockquote(line) ||
      isSeparator(line) ||
      preserveListLine ||
      looksAsciiDiagram(line)
    ) {
      if (
        inferSemanticHeadings &&
        isMarkdownHeading(line) &&
        shouldDemoteEntityHeadingInContext(lines, i, line)
      ) {
        const demoted = stripHeadingPrefix(line);
        out1.push(demoted);
        notes.push(`Demoted entity-like heading to text: ${demoted}`);
        stats.headingsFixed++;
        continue;
      }
      out1.push(line);
      continue;
    }

    if (/^\s*[\u2022\u2013]\s+/.test(line)) {
      line = line.replace(/^\s*[\u2022\u2013]\s+/, "- ");
      stats.bulletsNormalized++;
    }

    if (/^\s*\d+\)\s+/.test(line)) {
      line = line.replace(/^(\s*\d+)\)\s+/, "$1. ");
      stats.numberingNormalized++;
    }

    if (/^\s*Title:\s*$/.test(line) && i + 1 < lines.length) {
      const next = (lines[i + 1] ?? "").trim();
      if (next.length > 0 && !next.startsWith("#")) {
        out1.push(`# ${next}`);
        notes.push(`Converted Title: -> # ${next}`);
        stats.headingsFixed++;
        i += 1;
        continue;
      }
    }

    const sectionMatch = line.match(/^\s*Section:\s*(.+)\s*$/i);
    if (sectionMatch?.[1]) {
      const value = sectionMatch[1].trim();
      out1.push(`## ${value}`);
      notes.push(`Converted Section: -> ## ${value}`);
      stats.headingsFixed++;
      continue;
    }

    const subMatch = line.match(/^\s*Subsection:\s*(.+)\s*$/i);
    if (subMatch?.[1]) {
      const value = subMatch[1].trim();
      out1.push(`### ${value}`);
      notes.push(`Converted Subsection: -> ### ${value}`);
      stats.headingsFixed++;
      continue;
    }

    if (
      /^\s*(Phase|Step|Part|Module)\s+\d+/i.test(line) &&
      line.trim().length < 120
    ) {
      const prev = (lines[i - 1] ?? "").trim();
      const next = (lines[i + 1] ?? "").trim();
      const prevNB = prevNonBlankLine(lines, i - 1);
      const nextNB = nextNonBlankLine(lines, i + 1);

      // detect if we are inside a roadmap run
      if (
        /^\s*(Phase|Step|Part|Module)\s+\d+/i.test(prevNB) ||
        /^\s*(Phase|Step|Part|Module)\s+\d+/i.test(nextNB)
      ) {
        out1.push(line);
        continue;
      }

      // only promote if surrounded by blank lines
      if (prev === "" && next === "") {
        out1.push(`## ${line.trim()}`);
        notes.push(`Promoted to heading: ## ${line.trim()}`);
        stats.headingsFixed++;
        continue;
      }
    }

    if (inferSemanticHeadings) {
      const prev = lines[i - 1] ?? "";
      const next = lines[i + 1] ?? "";
      const nextNonBlank = nextNonBlankLine(lines, i + 1);

      if (isLikelyNumberedSectionTitle(line)) {
        const s = line.trim();
        const nextLine = nextNonBlank.trim();
        const prevLine = prevNonBlankLine(lines, i - 1).trim();
        const looksListItem = /^\d+[.)]\s+[a-z]/.test(s);
        const followsNumberedItem = /^\d+[.)]\s+/.test(prevLine);
        const followedByParagraphOrStructured =
          nextLine === "" ||
          /^\d+\.\d+\s+/.test(nextLine) ||
          isLikelyTableLike(nextLine) ||
          isFenceOpenLine(nextLine) !== null ||
          isLikelyCommand(nextLine) ||
          looksLikeCodeStart(nextLine) ||
          looksLikeCodeLineGeneric(nextLine) ||
          /^[A-Z]/.test(nextLine) ||
          /^[^\w]*[A-Z]/.test(nextLine);

        if (!looksListItem && !followsNumberedItem && followedByParagraphOrStructured) {
          const body = s.replace(/^\d+[.)]\s+/, "").trim();
          out1.push(`## ${body}`);
          notes.push(`Promoted numbered section title: ${body}`);
          stats.headingsFixed++;
          continue;
        }
      }

      if (!semanticTitleAssigned && i === 0 && isLikelySemanticHeadingLine(line)) {
        out1.push(`# ${line.trim()}`);
        notes.push(`Detected document title: ${line.trim()}`);
        stats.headingsFixed++;
        semanticTitleAssigned = true;
        continue;
      }

      if (
        semanticTitleAssigned &&
        i === 1 &&
        isLikelySemanticHeadingLine(line) &&
        (lines[i - 1] ?? "").trim() !== "" &&
        (lines[i + 1] ?? "").trim() === ""
      ) {
        out1.push(`## ${line.trim()}`);
        notes.push(`Detected semantic subtitle: ${line.trim()}`);
        stats.headingsFixed++;
        continue;
      }

      const nextNB = nextNonBlankLine(lines, i + 1);
      const prevNB = prevNonBlankLine(lines, i - 1);

      // block entity lists
      if (
        nextNB &&
        nextNB.split(/\s+/).length <= 3 &&
        !nextNB.endsWith(":")
      ) {
        out1.push(line);
        continue;
      }

      // block when previous line indicates a list intro
      if (
        prevNB &&
        /include|monitor|categories|integrates|sensors/i.test(prevNB)
      ) {
        out1.push(line);
        continue;
      }

      // block component lists introduced by description lines
      if (
        prevNB &&
        /engine|module|component|includes|integrates/i.test(prevNB)
      ) {
        out1.push(line);
        continue;
      }

      if (looksLikeTechnicalEntityLine(line)) {
        out1.push(line);
        continue;
      }

      if (isEntityListContextLine(lines, i)) {
        out1.push(line);
        continue;
      }

      if (shouldPromoteSemanticHeading(line, prev, next, nextNonBlank)) {
        out1.push(`## ${line.trim()}`);
        notes.push(`Promoted semantic heading: ${line.trim()}`);
        stats.headingsFixed++;
        continue;
      }
    }

    out1.push(line);
  }

  // 1b) Merge broken list items separated by single blank lines.
  const out1b: string[] = [];
  let inFence1 = false;
  let mergedListGaps = 0;
  for (let i = 0; i < out1.length; i++) {
    const line = out1[i] ?? "";
    if (isFenceLine(line)) {
      inFence1 = !inFence1;
      out1b.push(line);
      continue;
    }

    if (!inFence1 && line.trim() === "") {
      const prev = (out1b[out1b.length - 1] ?? "").trimEnd();
      const next = (out1[i + 1] ?? "").trimStart();
      if (isListItem(prev) && isListItem(next)) {
        mergedListGaps++;
        continue;
      }
    }

    out1b.push(line);
  }
  if (mergedListGaps > 0) {
    notes.push(`Merged ${mergedListGaps} blank line gap(s) inside lists`);
  }

  // 1c) Close unclosed fenced blocks at strong boundaries.
  const out1c: string[] = [];
  let inFenceC = false;
  let fenceOpenLine = "";

  for (let i = 0; i < out1b.length; i++) {
    const line = out1b[i] ?? "";

    if (!inFenceC) {
      const open = isFenceOpenLine(line);
      if (open !== null) {
        inFenceC = true;
        fenceOpenLine = line;
        out1c.push(line);
        continue;
      }

      out1c.push(line);
      continue;
    }

    // inside fence
    if (inFenceC && isFenceCloseLine(line)) {
      inFenceC = false;
      fenceOpenLine = "";
      out1c.push(line);
      continue;
    }

    // If user forgot closing fence, close it before strong boundary lines.
    if (fenceHasLanguage(fenceOpenLine) && isStrongBoundary(line)) {
      out1c.push("```");
      out1c.push("");
      stats.fencesAutoClosed++;
      notes.push("Auto-closed unclosed fenced block before strong section boundary");
      inFenceC = false;
      fenceOpenLine = "";

      // Process boundary line in non-fence mode.
      out1c.push(line);
      continue;
    }

    out1c.push(line);
  }

  // 2) Command streaks -> fenced code blocks (outside existing fences only).
  const out2: string[] = [];
  let inFence2 = false;
  for (let i = 0; i < out1c.length; i++) {
    const line = out1c[i] ?? "";

    if (isFenceLine(line)) {
      inFence2 = !inFence2;
      out2.push(line);
      continue;
    }

    if (!inFence2 && line.trim() && isLikelyCommand(line)) {
      const streak: string[] = [line];
      let j = i + 1;

      while (
        j < out1c.length &&
        (out1c[j] ?? "").trim() &&
        isLikelyCommand(out1c[j] ?? "")
      ) {
        streak.push(out1c[j] ?? "");
        j++;
      }

      if (streak.length >= 2) {
        const lang = detectCommandLang(streak);
        out2.push(`\`\`\`${lang}`);
        out2.push(...streak);
        out2.push("```");
        out2.push("");
        stats.commandBlocksCreated++;
        notes.push(`Wrapped ${streak.length} command lines as \`\`\`${lang} block`);
        i = j - 1;
        continue;
      }
    }

    out2.push(line);
  }

  // 2.1) Setup-label + following command/code grouping.
  const out2setup: string[] = [];
  let inFenceSetup = false;
  for (let i = 0; i < out2.length; i++) {
    const line = out2[i] ?? "";

    if (isFenceLine(line)) {
      inFenceSetup = !inFenceSetup;
      out2setup.push(line);
      continue;
    }

    if (inFenceSetup) {
      out2setup.push(line);
      continue;
    }

    if (isLikelySetupLabel(line)) {
      const block: string[] = [];
      let j = i + 1;

      while (j < out2.length) {
        const nxt = out2[j] ?? "";
        const t = nxt.trim();

        if (!t) {
          // allow one blank line inside command/setup blocks
          const nextLine = (out2[j + 1] ?? "").trim();
          if (block.length > 0 && isLikelyCommand(nextLine)) {
            block.push("");
            j++;
            continue;
          }
          if (block.length > 0) break;
          j++;
          continue;
        }

        if (
          isMarkdownHeading(nxt) ||
          isNumberHeading(nxt) ||
          isSeparator(nxt) ||
          isBlockquote(nxt) ||
          isLikelySemanticHeadingLine(nxt) ||
          looksLikeSectionTitle(nxt) ||
          isLikelyNumberedSectionTitle(nxt)
        ) {
          break;
        }

      if (
        isLikelyCommand(nxt) ||
        looksLikeCodeStart(nxt) ||
        looksLikeCodeLineGeneric(nxt) ||
        /^\s*#\s+/.test(nxt) ||
        /^\s*\\#\s+/.test(nxt) ||
        /^\s*--/.test(nxt)
      ) {
          block.push(nxt);
          j++;
          continue;
        }

        break;
      }

      if (block.length >= 1) {
        const lang = guessCodeLang(block);
        out2setup.push(line);
        out2setup.push("");
        out2setup.push(`\`\`\`${lang}`);
        out2setup.push(...block);
        out2setup.push("```");
        out2setup.push("");
        notes.push(`Wrapped setup block under "${line.trim()}" as \`\`\`${lang}`);
        i = j - 1;
        continue;
      }
    }

    out2setup.push(line);
  }

  // 2.5) Auto-fence unfenced multi-line code blocks.
  // 2.25) Commands label block -> fenced code (prevents Markdown from collapsing lines)
  const out2b: string[] = [];
  let inFenceCmd = false;

  for (let i = 0; i < out2setup.length; i++) {
    const line = out2setup[i] ?? "";

    if (isFenceLine(line)) {
      inFenceCmd = !inFenceCmd;
      out2b.push(line);
      continue;
    }

    // Only operate outside fences
    if (!inFenceCmd && isCommandsLabel(line)) {
      out2b.push(line);

      // Collect following non-empty lines until blank line or boundary
      const block: string[] = [];
      let j = i + 1;
      const isCommandish = (ln: string) =>
        isLikelyCommand(ln) || /^\s*#\s+/.test(ln) || ln.trim() === "";

      while (j < out2setup.length) {
        const nxt = out2setup[j] ?? "";
        if (isFenceLine(nxt)) break;
        // allow command lines, shell comments, and blanks
        if (isCommandish(nxt)) {
          block.push(nxt);
          j++;
          continue;
        }
        // structural boundaries
        if (isMarkdownHeading(nxt) || isNumberHeading(nxt)) break;
        if (isSeparator(nxt) || isBlockquote(nxt)) break;
        // stop on prose
        break;

      }

      // Only fence if we have at least 2 lines OR at least one looks like a command
      const hasCmd = block.some((b) => isLikelyCommand(b));
      if (block.length >= 2 || hasCmd) {
        const lang = detectCommandLang(block);
        out2b.push("```" + lang);

        // Keep "# ..." lines intact inside fenced command blocks
        for (const b of block) out2b.push(b);

        out2b.push("```");
        out2b.push("");
        stats.commandBlocksCreated++;
        notes.push(`Wrapped Commands: block as \`\`\`${lang}`);
        i = j - 1;
        continue;
      }

      // If not fenced, just output lines as-is
      out2b.push(...block);
      i = j - 1;
      continue;
    }

    out2b.push(line);
  }

  // 2.5) Auto-fence unfenced multi-line code blocks.
  const outCodeFenced: string[] = [];
  let inFenceAuto = false;

  for (let i = 0; i < out2b.length; i++) {
    const line = out2b[i] ?? "";

    // Never run auto-fence logic on fence markers.
    const openLang = isFenceOpenLine(line);
    if (openLang !== null || isFenceCloseLine(line)) {
      if (openLang !== null) inFenceAuto = true;
      if (isFenceCloseLine(line)) inFenceAuto = false;
      outCodeFenced.push(line);
      continue;
    }

    if (inFenceAuto) {
      outCodeFenced.push(line);
      continue;
    }

    // Never start auto-fence on structural markdown.
    if (
      isMarkdownHeading(line) ||
      isNumberHeading(line) ||
      isBlockquote(line) ||
      isSeparator(line) ||
      isListLine(line) ||
      isCommandsLabel(line)
    ) {
      outCodeFenced.push(line);
      continue;
    }

    const sqlLikeStart = isLikelySqlLike(line);
    if (looksLikeCodeStart(line) || sqlLikeStart) {
      const block: string[] = [line];
      let j = i + 1;
      let blankCount = 0;

      while (j < out2b.length) {
        const nxt = out2b[j] ?? "";
        const nxtTrimmed = nxt.trim();

        if (isFenceOpenLine(nxt) !== null) break;
        if (/^\s*#{1,6}\s+/.test(nxt)) break;
        if (/^\s*[-*]\s+/.test(nxt)) break;
        if (/^\s*\d+\.\s+/.test(nxt)) break;
        if (/^\s*\d+\)\s+/.test(nxt)) break;
        if (isSeparator(nxt)) break;
        if (isBlockquote(nxt)) break;

        if (!nxtTrimmed) {
          if (sqlLikeStart) {
            const nextNext = (out2b[j + 1] ?? "").trim();
            // allow blank lines inside SQL blocks if another SQL-ish line follows
            if (
              isLikelySqlLike(nextNext) ||
              /^["`A-Za-z_][A-Za-z0-9_"`]*\s+(INTEGER|TEXT|REAL|BLOB|NUMERIC|PRIMARY|REFERENCES|NOT|UNIQUE|CHECK|DEFAULT|COLLATE)\b/i.test(
                nextNext,
              ) ||
              nxtTrimmed === ");" ||
              /^[),;]+$/.test(nextNext) ||
              nextNext === ");"
            ) {
              block.push(nxt);
              j++;
              continue;
            }
            break;
          }
          blankCount++;
          if (blankCount > 1) break;
          block.push(nxt);
          j++;
          continue;
        }

        blankCount = 0;
        if (sqlLikeStart) {
          // keep SQL block open for SQL continuations and statement closers
          if (
            isLikelySqlLike(nxtTrimmed) ||
            /^["`A-Za-z_][A-Za-z0-9_"`]*\s+(INTEGER|TEXT|REAL|BLOB|NUMERIC|PRIMARY|REFERENCES|NOT|UNIQUE|CHECK|DEFAULT|COLLATE)\b/i.test(
              nxtTrimmed,
            ) ||
            nxtTrimmed === ");" ||
            /^[),;]+$/.test(nxtTrimmed)
          ) {
            block.push(nxt);
            j++;
            continue;
          }
          break;
        }
        if (!looksLikeCodeLineGeneric(nxt)) break;

        block.push(nxt);
        j++;
      }

      const strongSignals =
        block.length >= 3 ||
        block.some((value) => /[;{}]|=>/.test(value)) ||
        block.some((value) => /^\s{2,}\S+/.test(value));

      if (strongSignals) {
        const lang = guessCodeLang(block);
        outCodeFenced.push(`\`\`\`${lang}`);
        outCodeFenced.push(...block);
        outCodeFenced.push("```");
        outCodeFenced.push("");
        notes.push(`Auto-fenced unfenced code block as \`\`\`${lang}`);
        i = j - 1;
        continue;
      }
    }

    outCodeFenced.push(line);
  }

  // 3) Mermaid detection outside fenced blocks.
  const out3: string[] = [];
  let inFence3 = false;
  for (let i = 0; i < outCodeFenced.length; i++) {
    const line = outCodeFenced[i] ?? "";

    if (isFenceLine(line)) {
      inFence3 = !inFence3;
      out3.push(line);
      continue;
    }

    if (!inFence3) {
      const trimmed = line.trim();
      const looksMermaid = MERMAID_HINTS.some((hint) => trimmed.startsWith(hint));
      if (looksMermaid) {
        const block: string[] = [line];
        let j = i + 1;
        while (j < outCodeFenced.length) {
          const nxt = outCodeFenced[j] ?? "";
          const nxtTrimmed = nxt.trim();
          // allow blank lines inside Mermaid blocks
          if (!nxtTrimmed) {
            block.push(nxt);
            j++;
            continue;
          }
          if (/^\d+\.\d+/.test(nxtTrimmed)) break;
          if (/^(flowchart|graph|sequenceDiagram)/.test(nxtTrimmed)) break;
          if (isBlockBoundary(nxt)) break;
          block.push(nxt);
          j++;
        }
        out3.push("```mermaid");
        out3.push(...block);
        out3.push("```");
        out3.push("");
        stats.mermaidBlocksCreated++;
        notes.push("Detected mermaid-like block and fenced as ```mermaid");
        i = j - 1;
        continue;
      }
    }

    out3.push(line);
  }

  // ASCII diagram grouping (robust version)
  const outAscii: string[] = [];

  for (let i = 0; i < out3.length; i++) {
    const line = out3[i] ?? "";

    const isAsciiStart =
      /^[+\-]{3,}/.test(line.trim()) ||
      (/^\|[^|]*\|$/.test(line.trim()) && /^[+\-]/.test(out3[i - 1]?.trim() ?? ""));
    if (!isAsciiStart) {
      outAscii.push(line);
      continue;
    }

    const block: string[] = [line];
    let j = i + 1;

    while (j < out3.length) {
      const nxt = out3[j] ?? "";
      const trimmed = nxt.trim();

      // allow blank lines inside ASCII diagram
      if (trimmed === "") {
        block.push(nxt);
        j++;
        continue;
      }

      // connector lines
      if (/^[|v^]/i.test(trimmed)) {
        block.push(nxt);
        j++;
        continue;
      }

      // ascii box lines
      if (/^[+\-| ]{3,}/.test(trimmed)) {
        block.push(nxt);
        j++;
        continue;
      }

      break;
    }

    if (block.length >= 3) {
      outAscii.push("```ascii");
      outAscii.push(...block);
      outAscii.push("```");
      outAscii.push("");
      notes.push("Detected ASCII diagram and fenced as ```ascii");
      i = j - 1;
      continue;
    }

    outAscii.push(line);
  }

  // 3.5) Table detection (outside fences) -> markdown tables.
  const outTables: string[] = [];
  let inFence4 = false;

  for (let i = 0; i < outAscii.length; i++) {
    const line = outAscii[i] ?? "";

    if (isFenceLine(line)) {
      inFence4 = !inFence4;
      outTables.push(line);
      continue;
    }

    if (inFence4) {
      outTables.push(line);
      continue;
    }

    if (line.trim() === "") {
      outTables.push(line);
      continue;
    }

    const block: string[] = [];
    let j = i;
    while (j < outAscii.length) {
      const l = outAscii[j] ?? "";

      if (l.trim() === "") break;
      if (isFenceLine(l)) break;
      if (isMarkdownHeading(l) || isNumberHeading(l)) break;
      if (isSeparator(l)) break;
      if (isBlockquote(l)) break;

      block.push(l);
      j++;
    }

    if (block.length >= 2) {
      const mdPipey =
        block.some((value) => /^\s*\|/.test(value)) &&
        block.some((value) => value.includes("|"));

      if (mdPipey) {
        const maybeRows = block.map((value) =>
          value
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim()),
        );

        if (maybeRows.length >= 2 && looksLikeSeparatorRow(maybeRows[1] ?? [])) {
          outTables.push(...block);
          outTables.push("");
          i = j - 1;
          continue;
        }
      }

      const detectedHeader = detectTableHeader(block[0] ?? "");
      if (detectedHeader) {
        const mode = detectedHeader.mode;
        const header = detectedHeader.cols;
        const colCount = header.length;

        const secondLine = block[1] ?? "";
        const second =
          mode === "spacing"
            ? splitColumnsBySpacing(secondLine)
            : splitColumnsByPipes(secondLine);
        const isConfirmed = second.length >= 2;

        if (isConfirmed) {
          const rows: string[][] = [header];
          let consumed = 1;

          for (let k = 1; k < block.length; k++) {
            const ln = block[k] ?? "";
            if (ln.trim() === "") break;
            if (isSemanticBoundary(outAscii, i + k)) break;

            const cols =
              mode === "spacing" ? splitColumnsBySpacing(ln) : splitColumnsByPipes(ln);

            if (cols.length === colCount) {
              rows.push(cols);
              consumed = k + 1;
            } else if (cols.length >= 2 && cols.length < colCount) {
              rows.push(padRow(cols, colCount));
              consumed = k + 1;
            } else if (cols.length === 1) {
              appendToLastCell(rows, cols[0] ?? "");
              consumed = k + 1;
            } else {
              break;
            }
          }

          if (rows.length >= 2) {
            const mdTableLines = toMarkdownTable(rows);
            outTables.push(...mdTableLines);
            outTables.push("");
            stats.tablesConverted++;
            notes.push(
              `Converted wrapped table (${rows.length} rows x ${colCount} cols) to Markdown table`,
            );
            i = i + consumed - 1;
            continue;
          }
        }
      }
    }

    outTables.push(line);
  }

  // Table continuation repair
  const outTablesFixed: string[] = [];

  for (let i = 0; i < outTables.length; i++) {
    const line = outTables[i] ?? "";
    const prev = outTablesFixed[outTablesFixed.length - 1] ?? "";
    const next = outTables[i + 1] ?? "";

    const isPipeRow = /^\|.*\|$/.test(line.trim());
    const prevIsTableRow = /^\|.*\|$/.test(prev.trim());

    // If a pipe row appears after a blank line but follows a table
    if (
      isPipeRow &&
      prev.trim() === "" &&
      /^\|.*\|$/.test(outTablesFixed[outTablesFixed.length - 2] ?? "")
    ) {
      // remove blank line and attach row to table
      outTablesFixed.pop();
      outTablesFixed.push(line);
      continue;
    }

    outTablesFixed.push(line);
  }

  const outAfterTables = outTablesFixed;

  // 3.75) Fence Repair v2 — prevent accidental fence closure inside code.
  const outFenceSafe: string[] = [];
  let inFence5 = false;

  for (let i = 0; i < outAfterTables.length; i++) {
    const line = outAfterTables[i] ?? "";

    if (!inFence5) {
      const lang = isFenceOpenLine(line);
      if (lang !== null) {
        inFence5 = true;
        outFenceSafe.push(line);
        continue;
      }

      outFenceSafe.push(line);
      continue;
    }

    if (isFenceCloseLine(line)) {
      const n1 = outAfterTables[i + 1] ?? "";
      const n2 = outAfterTables[i + 2] ?? "";
      const suspicious =
        looksLikeCodeLine(n1) && (looksLikeCodeLine(n2) || n2.trim() === "");

      if (suspicious) {
        outFenceSafe.push(escapeBackticksInCodeLine(line));
        notes.push(
          "Prevented suspicious early fence close (treated as code literal)",
        );
        continue;
      }

      inFence5 = false;
      outFenceSafe.push(line);
      continue;
    }

    outFenceSafe.push(escapeBackticksInCodeLine(line));
  }

  const outFinalBeforeClose = outFenceSafe;

  // 4) Fence repair: auto-close unclosed fences at EOF.
  const fenceCount = outFinalBeforeClose.filter((line) =>
    /^\s*```/.test(line.trim()),
  ).length;
  let finalLines = outFinalBeforeClose;
  if (fenceCount % 2 === 1) {
    finalLines = [...outFinalBeforeClose, "```", ""];
    stats.fencesAutoClosed++;
    notes.push("Auto-closed an unclosed ``` fence at EOF");
  }

  // 5) Ensure final newline.
  let normalizedText = finalLines.join("\n");
  if (normalizedText.length > 0 && !normalizedText.endsWith("\n")) {
    normalizedText += "\n";
    notes.push("Appended final newline");
  }

  return { normalizedText, notes, stats };
}
