import { diffLines } from "diff";

export type DiffLine = {
  type: "add" | "del" | "same";
  text: string;
};

export function makeLineDiff(before: string, after: string): DiffLine[] {
  const parts = diffLines(before, after);
  const out: DiffLine[] = [];

  for (const p of parts) {
    const lines = p.value.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    for (const line of lines) {
      if (p.added) out.push({ type: "add", text: line });
      else if (p.removed) out.push({ type: "del", text: line });
      else out.push({ type: "same", text: line });
    }
  }

  return out;
}
