import type { NormalizeResult, NormalizeStats } from "./docModel";

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

function isFenceDelimiter(line: string): boolean {
  return /^```/.test(line.trim());
}

function isLikelyCommand(line: string): boolean {
  const s = line.trim();
  if (!s) return false;

  if (/^\$ /.test(s)) return true;
  if (/^PS [A-Z]:\\/.test(s)) return true;
  if (/^[A-Z]:\\.*>/.test(s)) return true;

  return (
    /^(npm|pnpm|yarn)\s+/.test(s) ||
    /^(pip|python|uvicorn|gunicorn)\s+/.test(s) ||
    /^(docker|docker-compose)\s+/.test(s) ||
    /^git\s+/.test(s) ||
    /^(curl|wget)\s+/.test(s) ||
    /^sudo\s+/.test(s)
  );
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

/**
 * Phase 4: deterministic Smart Normalizer v1.
 */
export function normalizeInput(rawText: string): NormalizeResult {
  const notes: string[] = [];
  const stats: NormalizeStats = {
    fencesAutoClosed: 0,
    headingsFixed: 0,
    bulletsNormalized: 0,
    numberingNormalized: 0,
    commandBlocksCreated: 0,
    mermaidBlocksCreated: 0,
  };

  // 0) Normalize line endings + trim trailing whitespace.
  const text = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");
  const lines = text.split("\n");

  // 1) Heading + bullet/number normalization.
  const out1: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] ?? "";

    if (/^\s*[•–]\s+/.test(line)) {
      line = line.replace(/^\s*[•–]\s+/, "- ");
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
      const t = sectionMatch[1].trim();
      out1.push(`## ${t}`);
      notes.push(`Converted Section: -> ## ${t}`);
      stats.headingsFixed++;
      continue;
    }

    const subMatch = line.match(/^\s*Subsection:\s*(.+)\s*$/i);
    if (subMatch?.[1]) {
      const t = subMatch[1].trim();
      out1.push(`### ${t}`);
      notes.push(`Converted Subsection: -> ### ${t}`);
      stats.headingsFixed++;
      continue;
    }

    if (/^\s*(Phase|Step|Part|Module)\s+\d+/i.test(line) && line.trim().length < 120) {
      const prev = (lines[i - 1] ?? "").trim();
      const next = (lines[i + 1] ?? "").trim();
      if (prev === "" && next === "") {
        out1.push(`## ${line.trim()}`);
        notes.push(`Promoted to heading: ## ${line.trim()}`);
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
    if (isFenceDelimiter(line)) {
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

  // 2) Command streaks -> fenced code blocks (outside existing fences only).
  const out2: string[] = [];
  let inFence2 = false;
  for (let i = 0; i < out1b.length; i++) {
    const line = out1b[i] ?? "";

    if (isFenceDelimiter(line)) {
      inFence2 = !inFence2;
      out2.push(line);
      continue;
    }

    if (!inFence2 && line.trim() && isLikelyCommand(line)) {
      const streak: string[] = [line];
      let j = i + 1;

      while (j < out1b.length && (out1b[j] ?? "").trim() && isLikelyCommand(out1b[j] ?? "")) {
        streak.push(out1b[j] ?? "");
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

  // 3) Mermaid detection outside fenced blocks.
  const out3: string[] = [];
  let inFence3 = false;
  for (let i = 0; i < out2.length; i++) {
    const line = out2[i] ?? "";

    if (isFenceDelimiter(line)) {
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
        while (j < out2.length && (out2[j] ?? "").trim() !== "") {
          block.push(out2[j] ?? "");
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

  // 4) Fence repair: auto-close unclosed fences at EOF.
  const fenceCount = out3.filter((line) => isFenceDelimiter(line)).length;
  let finalLines = out3;
  if (fenceCount % 2 === 1) {
    finalLines = [...out3, "```", ""];
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
