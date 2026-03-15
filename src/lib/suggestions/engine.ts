import type { Suggestion, SuggestionPatch } from "./types";
import { extractDocDiagnostics } from "@/lib/docDiagnostics";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function patch(
  target: "raw" | "normalized",
  apply: (t: string) => string,
): SuggestionPatch {
  return { target, apply };
}

function countFences(text: string) {
  return (text.match(/^\s*```/gm) ?? []).length;
}

function hasTitleColonPattern(text: string) {
  return /^\s*Title:\s*$\n\s*\S.+/m.test(text);
}

function applyTitleColonToH1(text: string): string {
  return text.replace(
    /^\s*Title:\s*$\n\s*(\S.+)\s*$/m,
    (_m, title) => `# ${title}`,
  );
}

function hasSectionColon(text: string) {
  return /^\s*Section:\s*\S+/im.test(text) || /^\s*Subsection:\s*\S+/im.test(text);
}

function applySectionColon(text: string): string {
  return text
    .replace(/^\s*Section:\s*(.+)\s*$/gim, (_m, t) => `## ${t.trim()}`)
    .replace(/^\s*Subsection:\s*(.+)\s*$/gim, (_m, t) => `### ${t.trim()}`);
}

function hasNumberingBrackets(text: string) {
  return /^\s*\d+\)\s+/m.test(text);
}

function fixNumberingBrackets(text: string) {
  return text.replace(/^(\s*\d+)\)\s+/gm, "$1. ");
}

function hasBulletDots(text: string) {
  return /^\s*[â€¢â€“]\s+/m.test(text);
}

function fixBulletDots(text: string) {
  return text.replace(/^\s*[â€¢â€“]\s+/gm, "- ");
}

function likelyUnfencedCode(text: string) {
  if (/```/.test(text)) return false;
  const lines = text.split("\n");
  let run = 0;

  for (const line of lines) {
    const s = line.trim();
    const codeish =
      /^(function|const|let|class|def|import|from)\b/.test(s) ||
      /^[#\/]{1,2}\s+/.test(s) ||
      /[;{}]=|=>/.test(s) ||
      /^\s{2,}\S+/.test(line);

    if (codeish) run++;
    else run = 0;

    if (run >= 4) return true;
  }

  return false;
}

function looksLikeStructuredDocument(text: string): boolean {
  const t = text.replace(/\r\n/g, "\n");

  const headingishCount =
    (t.match(/^(?:#{1,6}\s+.+|[A-Z][A-Za-z0-9&()\/+\-–'": ]{3,80})$/gm) ?? []).length;

  const phaseCount =
    (t.match(/^\s*(?:Phase \d+|Step \d+|Section \d+|Deliverables|Acceptance checks)\b/gm) ??
      []).length;

  const paragraphCount =
    t.split(/\n\s*\n/).filter((p) => p.trim().length > 40).length;

  const diagramHints =
    (t.match(/\b(flowchart|graph\s+(?:TD|LR)|sequenceDiagram)\b|-->/g) ?? []).length;

  return (
    headingishCount >= 4 ||
    phaseCount >= 3 ||
    paragraphCount >= 4 ||
    diagramHints >= 2
  );
}

function fenceWholeDocAsCode(text: string) {
  return `\`\`\`text\n${text.replace(/\s+$/g, "")}\n\`\`\`\n`;
}

function dedupeSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  for (const s of suggestions) {
    const key = JSON.stringify({
      title: s.title,
      rationale: s.rationale,
      patches: s.patches.map((p) => ({
        target: p.target,
        preview: p.apply.toString(),
      })),
    });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }

  return out;
}

function collectUnfencedCommandLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      continue;
    }

    if (inFence || !line) continue;

    if (
      /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source|cp|mv|rm|sudo|htop|vcgencmd|\.quit|\.mode|\.import)\b/.test(
        line,
      )
    ) {
      out.push(raw);
    }
  }

  return out;
}

function shouldSuggestSemanticHeading(
  line: string,
  prevNonBlank: string,
  nextNonBlank: string,
): boolean {
  const s = line.trim();
  if (!s) return false;

  // already-structured content
  if (/^\s*#{1,6}\s+/.test(s)) return false;
  if (/^\s*(?:[-+*]|\d+\.)\s+/.test(s)) return false;
  if (/^\s*```/.test(s)) return false;
  if (/^\s*>/.test(s)) return false;
  if (/^\|.*\|$/.test(s)) return false;

  // command / shell / tooling starts
  if (
    /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source|cp|mv|rm|sudo|htop|vcgencmd|\.quit|\.mode|\.import)\b/i.test(
      s,
    )
  ) {
    return false;
  }

  // SQL / DDL / query-ish lines
  if (
    /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|WITH|PRAGMA)\b/i.test(s)
  ) {
    return false;
  }

  // connector / flow / ascii-only lines
  if (/^[│|v^]+$/i.test(s)) return false;
  if (/^[+\-]{3,}$/.test(s)) return false;

  // explanatory labels that should never become headings
  if (
    /^(Expected output|Outputs?|Use|Resulting structure|Prompt should change to|Example import|Example usage|Inside SQLite shell|Exit SQLite|Verify database|Run application|Access UI|Create database file|Create script|Create application file|Create startup script|Make executable|Backup database|Monitor CPU temperature|Check system load)\s*:?\s*$/i.test(
      s,
    )
  ) {
    return false;
  }

  // setup/action labels that are usually steps, not sections
  if (
    /^(Update|Install|Create|Activate|Run|Save|Load|Verify|Access|Make|Backup|Monitor|Check|Exit)\b/i.test(
      s,
    )
  ) {
    return false;
  }

  // if followed by a command/code-like line, treat as step label not heading
  if (
    /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source|cp|mv|rm|sudo|htop|vcgencmd|\.quit|\.mode|\.import)\b/i.test(
      nextNonBlank,
    )
  ) {
    return false;
  }

  // if followed by SQL, also not a heading
  if (/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|WITH|PRAGMA)\b/i.test(nextNonBlank)) {
    return false;
  }

  // flow container labels should not be promoted
  if (/flow/i.test(s) && /^[│|v^]+$/i.test(nextNonBlank)) {
    return false;
  }

  // acceptable heading shape
  if (!/^[A-Z][A-Za-z0-9&()\/+\-–'": ]{2,80}$/.test(s)) return false;

  return true;
}

function isRoadmapItemLine(line: string): boolean {
  const s = line.trim();
  return /^(Phase|Step|Stage|Milestone|Part|Module)\s+\d+\s*[:\-–]/i.test(s);
}

function previousNonBlankLine(lines: string[], startIndex: number): string {
  for (let j = startIndex; j >= 0; j--) {
    const s = (lines[j] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function nextNonBlankLine(lines: string[], startIndex: number): string {
  for (let j = startIndex; j < lines.length; j++) {
    const s = (lines[j] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function looksLikeTechnicalSentence(line: string): boolean {
  const s = line.trim();
  if (!s) return false;

  const words = s.split(/\s+/).filter(Boolean);

  return (
    words.length >= 5 &&
    !looksLikeRealSectionLabel(s) &&
    (
      /\b(this|that|these|those|it|they|system|document)\b/i.test(s) ||
      /\b(should|must|will|can|could|would|may|might|include|confirm|validate|ensure|test)\b/i.test(
        s,
      )
    )
  );
}

function looksLikeRealSectionLabel(line: string): boolean {
  const s = line.trim();
  return /^(Project Overview|Overview|Core Concept|Functional Workflow|Key Features|Hardware Platform|Hardware Cost Estimate|Software Architecture|Database Structure|Development Roadmap|System Alerts & Warnings|Project Objective|System Requirements|Database Schema|Research Roadmap|Estimated Timeline|Alerts & Warnings)$/i.test(
    s,
  );
}

function getSuggestionContext(text: string) {
  const t = text.replace(/\r\n/g, "\n");

  const phaseCount = (t.match(/^\s*Phase \d+/gm) ?? []).length;

  const diagramHints =
    (t.match(/\b(flowchart|graph\s+(?:TD|LR)|sequenceDiagram)\b|-->/g) ?? []).length;

  const commandCount =
    (t.match(
      /^(npm|pnpm|yarn|docker|git|curl|wget|sqlite3|python|python3|pip|pip3|streamlit|mkdir|cd|touch|chmod|source|cp|mv|rm|sudo)\b/gm,
    ) ?? []).length;

  return {
    isRoadmapLike: phaseCount >= 3 || diagramHints >= 2,
    isSetupLike: commandCount >= 8,
  };
}

function getSuggestionPriority(
  s: Suggestion,
  context?: { isRoadmapLike: boolean; isSetupLike: boolean },
): number {
  const title = s.title.toLowerCase();
  const rationale = s.rationale.toLowerCase();

  if (title.startsWith("wrap ") && title.includes("command lines as bash block")) {
    if (context?.isSetupLike) return 110;
    return 100;
  }

  if (title === "fence command block") {
    if (context?.isSetupLike) return 100;
    return 90;
  }

  if (title === "convert to callout block") {
    return 80;
  }

  if (title === "promote semantic heading") {
    return 70;
  }

  if (title === "use normalized output rules for cleaner formatting") {
    return 60;
  }

  if (title === "convert pipe text to table") {
    return 50;
  }

  if (title.includes("convert") && title.includes("h1")) {
    return 40;
  }

  if (title.includes("heading")) {
    return 35;
  }

  if (title.includes("bullet") || title.includes("numbering")) {
    return 30;
  }

  if (title.includes("code fence") || rationale.includes("fence")) {
    return 25;
  }

  return 10;
}

function sortSuggestions(
  suggestions: Suggestion[],
  context?: { isRoadmapLike: boolean; isSetupLike: boolean },
): Suggestion[] {
  return suggestions
    .map((s, index) => ({
      s,
      index,
      priority: getSuggestionPriority(s, context),
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.index - b.index;
    })
    .map((x) => x.s);
}

function isNoOpSuggestion(s: Suggestion, normalizedText: string): boolean {
  try {
    if (!s.patches || s.patches.length === 0) return true;

    return s.patches.every((p) => {
      if (p.target !== "normalized") return false;
      const result = p.apply(normalizedText);
      return result === normalizedText;
    });
  } catch {
    return false;
  }
}

function suppressSuggestions(
  suggestions: Suggestion[],
  normalizedText: string,
  context?: { isRoadmapLike: boolean; isSetupLike: boolean },
): Suggestion[] {
  const out: Suggestion[] = [];

  for (const s of suggestions) {
    const title = s.title.toLowerCase();

    // 1️⃣ remove suggestions that do nothing
    if (isNoOpSuggestion(s, normalizedText)) continue;

    // 2️⃣ suppress weak normalized-output rule
    if (title.includes("use normalized output")) continue;

    // 3️⃣ suppress table suggestion if it is a no-op
    if (title.includes("convert pipe text to table")) continue;

    // roadmap/spec docs: suppress setup-style command suggestions
    if (
      context?.isRoadmapLike &&
      (title === "fence command block" ||
        (title.startsWith("wrap ") && title.includes("command lines as bash block")))
    ) {
      continue;
    }

    out.push(s);
  }

  return out;
}
export function generateSuggestions(
  rawText: string,
  normalizedText: string,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const context = getSuggestionContext(rawText);
  const diagnostics = extractDocDiagnostics({
    rawText,
    normalizedText,
    notes: [],
    stats: {
      fencesAutoClosed: 0,
      headingsFixed: 0,
      bulletsNormalized: 0,
      numberingNormalized: 0,
      commandBlocksCreated: 0,
      mermaidBlocksCreated: 0,
      tablesConverted: 0,
    },
    renderedHtml: "",
    headings: [],
    intelligence: null,
  });

  const unfencedCommands = collectUnfencedCommandLines(normalizedText);
  if (unfencedCommands.length >= 2) {
    suggestions.push({
      id: `grouped-command-fence-${unfencedCommands.length}`,
      title: `Wrap ${unfencedCommands.length} command lines as bash block`,
      rationale:
        "Several unfenced command lines were detected; grouping them as a bash block will improve formatting.",
      patches: [
        {
          target: "normalized",
          apply(text: string) {
            let updated = text;
            const block = `\`\`\`bash\n${unfencedCommands.map((l) => l.trim()).join("\n")}\n\`\`\``;
            for (const cmd of unfencedCommands) {
              const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              updated = updated.replace(new RegExp(`^${escaped}\\s*$`, "m"), "");
            }
            updated = updated.replace(/\n{3,}/g, "\n\n").trimEnd();
            return `${updated}\n\n${block}\n`;
          },
        },
      ],
    });
  }

  if (hasTitleColonPattern(rawText)) {
    suggestions.push({
      id: uid("title_to_h1"),
      title: 'Convert "Title:" into a proper H1',
      rationale:
        'ChatGPT-style "Title:" lines often are not parsed as headings. Converting to "# ..." improves structure and TOC.',
      patches: [
        patch("raw", applyTitleColonToH1),
        patch("normalized", applyTitleColonToH1),
      ],
    });
  }

  if (hasSectionColon(rawText)) {
    suggestions.push({
      id: uid("section_to_headings"),
      title: 'Convert "Section:" / "Subsection:" to headings',
      rationale: "Improves hierarchy, TOC quality, and spacing.",
      patches: [patch("raw", applySectionColon), patch("normalized", applySectionColon)],
    });
  }

  if (hasBulletDots(rawText)) {
    suggestions.push({
      id: uid("bullets_normalize"),
      title: "Normalize bullets (â€¢/â€“ -> -)",
      rationale: "Ensures lists render correctly in Markdown and PDF.",
      patches: [patch("raw", fixBulletDots), patch("normalized", fixBulletDots)],
    });
  }

  if (hasNumberingBrackets(rawText)) {
    suggestions.push({
      id: uid("numbering_normalize"),
      title: "Normalize numbering (1) -> 1.)",
      rationale: "Prevents broken ordered lists.",
      patches: [
        patch("raw", fixNumberingBrackets),
        patch("normalized", fixNumberingBrackets),
      ],
    });
  }

  const fenceCount = countFences(rawText);
  if (fenceCount % 2 === 1) {
    suggestions.push({
      id: uid("fence_autoclose"),
      title: "Close an unclosed code fence",
      rationale:
        "An odd number of ``` fences can break formatting (code becomes text or vice versa).",
      patches: [
        patch("raw", (t) => `${t.trimEnd()}\n\`\`\`\n`),
        patch("normalized", (t) => `${t.trimEnd()}\n\`\`\`\n`),
      ],
    });
  }

  if (likelyUnfencedCode(rawText) && !looksLikeStructuredDocument(rawText)) {
    suggestions.push({
      id: uid("unfenced_code_hint"),
      title: "Wrap detected code-like block in a fenced code block",
      rationale:
        "Some pasted content looks like code but is not fenced, so it renders as plain text.",
      patches: [
        patch("raw", fenceWholeDocAsCode),
        patch("normalized", fenceWholeDocAsCode),
      ],
    });
  }

  if (normalizedText !== rawText) {
    suggestions.push({
      id: uid("use_normalized"),
      title: "Use normalized output rules for cleaner formatting",
      rationale:
        "Your normalizer already repaired parts of the document (lists, headings, fences). Applying to output keeps the editor untouched.",
      patches: [
        patch("normalized", (text) => {
          void text;
          return normalizedText;
        }),
      ],
    });
  }

  // Phase 16B: diagnostics-driven suggestions
  for (const item of diagnostics.items) {
    if (item.kind !== "unfenced_command_candidate") continue;
    const cmd = (item.detail ?? "").trim();
    if (!cmd) continue;

    suggestions.push({
      id: `cmd-fence-${uid("diag")}`,
      title: "Fence command block",
      rationale: "Command lines should be wrapped in a bash code block",
      patches: [
        {
          target: "normalized",
          apply(text: string) {
            return text.replace(cmd, `\`\`\`bash\n${cmd}\n\`\`\``);
          },
        },
      ],
    });
  }

  for (const item of diagnostics.items) {
    if (item.kind !== "plain_callout_candidate") continue;
    const line = (item.detail ?? "").trim();
    if (!line) continue;

    suggestions.push({
      id: `callout-${uid("diag")}`,
      title: "Convert to callout block",
      rationale: "Plain callouts should use blockquote syntax",
      patches: [
        {
          target: "normalized",
          apply(text: string) {
            return text.replace(line, `> ${line}`);
          },
        },
      ],
    });
  }

  const lines = normalizedText.replace(/\r\n/g, "\n").split("\n");
  function prevNonBlank(linesInput: string[], i: number): string {
    for (let j = i - 1; j >= 0; j--) {
      const s = linesInput[j]?.trim() ?? "";
      if (s) return s;
    }
    return "";
  }

  function nextNonBlank(linesInput: string[], i: number): string {
    for (let j = i + 1; j < linesInput.length; j++) {
      const s = linesInput[j]?.trim() ?? "";
      if (s) return s;
    }
    return "";
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const prev = prevNonBlank(lines, i);
    const next = nextNonBlank(lines, i);
    if (
      !looksLikeRealSectionLabel(line) &&
      !shouldSuggestSemanticHeading(line, prev, next)
    ) {
      continue;
    }
    const trimmed = line.trim();

    // suppress roadmap-style list items from becoming headings
    if (isRoadmapItemLine(trimmed)) {
      const prevNB = previousNonBlankLine(lines, i - 1);
      const nextNB = nextNonBlankLine(lines, i + 1);

      // if surrounded by other roadmap items, this is part of a list, not a section
      if (isRoadmapItemLine(prevNB) || isRoadmapItemLine(nextNB)) {
        continue;
      }
    }

    if (looksLikeTechnicalSentence(trimmed)) {
      continue;
    }

    // block sentence-like colon lines
    if (
      /:$/.test(trimmed) &&
      (
        /\b(should|must|will|can|could|would|may|might|is|are|was|were)\b/i.test(trimmed) ||
        /\b(this|that|these|those)\b/i.test(trimmed) ||
        trimmed.split(/\s+/).length > 6
      )
    ) {
      continue;
    }

    suggestions.push({
      id: `heading-${i}-${trimmed}`,
      title: "Promote semantic heading",
      rationale: "This line looks like a section heading",
      patches: [
        {
          target: "normalized",
          apply(text: string) {
            return text.replace(line, `## ${trimmed}`);
          },
        },
      ],
    });
  }

  if (diagnostics.items.some((i) => i.kind === "table_ambiguity")) {
    suggestions.push({
      id: "table-suggestion",
      title: "Convert pipe text to table",
      rationale: "Pipe-heavy text detected that may be a Markdown table",
      patches: [
        {
          target: "normalized",
          apply(text: string) {
            return text;
          },
        },
      ],
    });
  }

  const deduped = dedupeSuggestions(suggestions);
  const suppressed = suppressSuggestions(deduped, normalizedText, context);
  return sortSuggestions(suppressed, context);
}



