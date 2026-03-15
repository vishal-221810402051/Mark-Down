export function computePreview(
  text: string,
  patch: (t: string) => string,
): { before: string; after: string } {
  const after = patch(text);

  const beforeLines = text.split("\n");
  const afterLines = after.split("\n");

  for (let i = 0; i < Math.min(beforeLines.length, afterLines.length); i++) {
    if (beforeLines[i] !== afterLines[i]) {
      return {
        before: beforeLines[i] ?? "",
        after: afterLines[i] ?? "",
      };
    }
  }

  return { before: "", after: "" };
}
