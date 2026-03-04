"use client";

import type { DiffLine } from "@/lib/suggestions/diff";

export default function DiffViewer({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
      <div className="max-h-64 overflow-auto font-mono text-xs leading-5">
        {lines.length === 0 ? (
          <div className="text-white/50">No changes.</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <span
                className={[
                  "w-5 text-center",
                  line.type === "add"
                    ? "text-emerald-300"
                    : line.type === "del"
                      ? "text-rose-300"
                      : "text-white/30",
                ].join(" ")}
              >
                {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
              </span>
              <span
                className={[
                  "whitespace-pre-wrap break-words",
                  line.type === "add"
                    ? "text-emerald-100"
                    : line.type === "del"
                      ? "text-rose-100 line-through decoration-rose-300/50"
                      : "text-white/80",
                ].join(" ")}
              >
                {line.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
