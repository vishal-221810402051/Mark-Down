export type FormatAction =
  | { type: "codeblock"; lang?: string }
  | { type: "inlinecode" }
  | { type: "h2" | "h3" | "h4" }
  | { type: "blockquote" }
  | { type: "ul" }
  | { type: "ol" };

export type ApplyMode = "raw" | "output";

export type SelectionContext = {
  selectedText: string;
  before: string;
  after: string;
};

function normalizeNewlines(s: string) {
  return s.replace(/\r\n/g, "\n");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyFormat(
  source: string,
  ctx: SelectionContext,
  action: FormatAction,
): { ok: boolean; next: string; error?: string } {
  const src = normalizeNewlines(source);
  const selected = normalizeNewlines(ctx.selectedText);
  if (!selected.trim()) return { ok: false, next: src, error: "Empty selection" };

  // Best-effort unique match using context window
  const before = normalizeNewlines(ctx.before);
  const after = normalizeNewlines(ctx.after);

  // Prefer matching with context (before+selected+after)
  let startIdx = -1;
  let endIdx = -1;
  const windowPattern =
    escapeRegExp(before) + escapeRegExp(selected) + escapeRegExp(after);
  const windowRe = new RegExp(windowPattern, "m");
  const windowMatch = src.match(windowRe);

  if (windowMatch && windowMatch.index !== undefined) {
    startIdx = windowMatch.index + before.length;
    endIdx = startIdx + selected.length;
  } else {
    // Fallback: direct selection match (first occurrence)
    startIdx = src.indexOf(selected);
    if (startIdx >= 0) endIdx = startIdx + selected.length;
  }

  if (startIdx < 0 || endIdx < 0) {
    return { ok: false, next: src, error: "Could not locate selection in source" };
  }

  const beforeText = src.slice(0, startIdx);
  const selText = src.slice(startIdx, endIdx);
  const afterText = src.slice(endIdx);

  const transformed = transformSelection(selText, action);

  return { ok: true, next: beforeText + transformed + afterText };
}

function transformSelection(sel: string, action: FormatAction): string {
  const trimmed = sel.replace(/\s+$/g, "");
  const suffix = sel.slice(trimmed.length); // preserve trailing whitespace

  switch (action.type) {
    case "inlinecode":
      return "`" + trimmed + "`" + suffix;
    case "codeblock": {
      const lang = action.lang?.trim() || "text";
      return `\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n` + suffix;
    }
    case "blockquote": {
      const lines = trimmed.split("\n").map((l) => (l.trim() ? `> ${l}` : ">"));
      return lines.join("\n") + suffix;
    }
    case "ul": {
      const lines = trimmed.split("\n").map((l) => (l.trim() ? `- ${l}` : ""));
      return lines.join("\n") + suffix;
    }
    case "ol": {
      let n = 1;
      const lines = trimmed.split("\n").map((l) => {
        if (!l.trim()) return "";
        const out = `${n}. ${l}`;
        n += 1;
        return out;
      });
      return lines.join("\n") + suffix;
    }
    case "h2":
    case "h3":
    case "h4": {
      // Heading action: apply to the entire line(s) selected (first non-empty line)
      const level = action.type === "h2" ? "##" : action.type === "h3" ? "###" : "####";
      const lines = trimmed.split("\n");
      const idx = lines.findIndex((l) => l.trim().length > 0);
      if (idx === -1) return sel;
      lines[idx] = `${level} ${lines[idx].replace(/^#{1,6}\s+/, "")}`;
      return lines.join("\n") + suffix;
    }
  }
}
