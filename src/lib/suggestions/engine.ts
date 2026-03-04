import type { Suggestion, SuggestionPatch } from "./types";

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
  return /^\s*[•–]\s+/m.test(text);
}

function fixBulletDots(text: string) {
  return text.replace(/^\s*[•–]\s+/gm, "- ");
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

function fenceWholeDocAsCode(text: string) {
  return `\`\`\`text\n${text.replace(/\s+$/g, "")}\n\`\`\`\n`;
}

export function generateSuggestions(
  rawText: string,
  normalizedText: string,
): Suggestion[] {
  const sug: Suggestion[] = [];

  if (hasTitleColonPattern(rawText)) {
    sug.push({
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
    sug.push({
      id: uid("section_to_headings"),
      title: 'Convert "Section:" / "Subsection:" to headings',
      rationale: "Improves hierarchy, TOC quality, and spacing.",
      patches: [patch("raw", applySectionColon), patch("normalized", applySectionColon)],
    });
  }

  if (hasBulletDots(rawText)) {
    sug.push({
      id: uid("bullets_normalize"),
      title: "Normalize bullets (•/– -> -)",
      rationale: "Ensures lists render correctly in Markdown and PDF.",
      patches: [patch("raw", fixBulletDots), patch("normalized", fixBulletDots)],
    });
  }

  if (hasNumberingBrackets(rawText)) {
    sug.push({
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
    sug.push({
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

  if (likelyUnfencedCode(rawText)) {
    sug.push({
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
    sug.push({
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

  return sug;
}
