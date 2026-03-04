/**
 * Phase 2: Safe text-only render (escape HTML).
 * Phase 3: Replace with Markdown->AST->HTML renderer.
 */
export function renderSafePreview(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
