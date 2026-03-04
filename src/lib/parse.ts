import type { ParseResult } from "./docModel";

/**
 * Phase 2: Parser placeholder only.
 * Phase 3: replace with remark/rehype markdown parsing pipeline.
 */
export function parseNormalizedText(normalizedText: string): ParseResult {
  return {
    parseOutput: normalizedText,
    notes: [],
  };
}
