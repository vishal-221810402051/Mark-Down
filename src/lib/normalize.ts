import type { NormalizeResult } from "./docModel";

/**
 * Phase 2: Minimal normalization only.
 * Phase 4: This will become the Smart Normalizer v1.
 */
export function normalizeInput(rawText: string): NormalizeResult {
  const notes: string[] = [];

  // Minimal cleanup: normalize line endings and trim trailing spaces
  let t = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");

  // Ensure final newline (helps later parsing and code fences)
  if (t.length > 0 && !t.endsWith("\n")) {
    t += "\n";
    notes.push("Appended final newline");
  }

  return { normalizedText: t, notes };
}
