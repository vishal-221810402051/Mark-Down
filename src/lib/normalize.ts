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

function isListLine(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
}

function detectTableHeader(line: string): { mode: "spacing" | "pipes"; cols: string[] } | null {
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
    /^(pip|python|uvicorn|gunicorn)\s+/.test(s) ||
    /^(docker|docker-compose)\s+/.test(s) ||
    /^git\s+/.test(s) ||
    /^(curl|wget)\s+/.test(s) ||
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

/**
 * Phase 4/7: deterministic Smart Normalizer.
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
    tablesConverted: 0,
  };

  // 0) Normalize line endings + trim trailing whitespace.
  const text = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");
  const lines = text.split("\n");

  // 1) Heading + bullet/number normalization.
  const out1: string[] = [];
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

    // Treat "# ..." as heading only when separated by a blank line.
    if (/^\s*#\s+/.test(line)) {
      const prev = (lines[i - 1] ?? "").trim();
      if (prev !== "") {
        out1.push(line);
        continue;
      }
    }

    if (
      isMarkdownHeading(line) ||
      isNumberHeading(line) ||
      isBlockquote(line) ||
      isSeparator(line) ||
      isListLine(line) ||
      looksAsciiDiagram(line)
    ) {
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

  // 2.5) Auto-fence unfenced multi-line code blocks.
  // 2.25) Commands label block -> fenced code (prevents Markdown from collapsing lines)
  const out2b: string[] = [];
  let inFenceCmd = false;

  for (let i = 0; i < out2.length; i++) {
    const line = out2[i] ?? "";

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

      while (j < out2.length) {
        const nxt = out2[j] ?? "";
        if (nxt.trim() === "") break;
        if (isFenceLine(nxt)) break;
        if (isSeparator(nxt) || isBlockquote(nxt)) break;

        block.push(nxt);
        j++;
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

    const openLang = isFenceOpenLine(line);
    if (openLang !== null) {
      inFenceAuto = true;
      outCodeFenced.push(line);
      continue;
    }
    if (inFenceAuto && isFenceCloseLine(line)) {
      inFenceAuto = false;
      outCodeFenced.push(line);
      continue;
    }
    if (inFenceAuto) {
      outCodeFenced.push(line);
      continue;
    }

    if (looksLikeCodeStart(line)) {
      const block: string[] = [line];
      let j = i + 1;
      let blankCount = 0;

      while (j < out2b.length) {
        const nxt = out2b[j] ?? "";

        if (isFenceOpenLine(nxt) !== null) break;
        if (/^\s*#{1,6}\s+/.test(nxt)) break;
        if (/^\s*[-*]\s+/.test(nxt)) break;
        if (/^\s*\d+\.\s+/.test(nxt)) break;

        if (nxt.trim() === "") {
          blankCount++;
          if (blankCount > 1) break;
          block.push(nxt);
          j++;
          continue;
        }

        blankCount = 0;
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
          if (nxt.trim() === "") break;
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

  // 3.5) Table detection (outside fences) -> markdown tables.
  const outTables: string[] = [];
  let inFence4 = false;

  for (let i = 0; i < out3.length; i++) {
    const line = out3[i] ?? "";

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
    while (j < out3.length) {
      const l = out3[j] ?? "";

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
            if (isBlockBoundary(ln)) break;

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

  const outAfterTables = outTables;

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



