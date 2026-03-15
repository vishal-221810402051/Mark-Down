"use client";

import { useState } from "react";
import DiffViewer from "@/components/DiffViewer";
import { makeLineDiff } from "@/lib/suggestions/diff";
import { computePreview } from "@/lib/suggestions/preview";
import type { Suggestion } from "@/lib/suggestions/types";

type Props = {
  open: boolean;
  onClose: () => void;
  suggestions: Suggestion[];
  rawText: string;
  normalizedText: string;
  onApplyRaw: (s: Suggestion) => void;
  onApplyNormalized: (s: Suggestion) => void;
  onApplyAllRaw: () => void;
  onApplyAllNormalized: () => void;
  onRevertRaw: () => void;
  onRevertNormalized: () => void;
  hasRawBaseline: boolean;
  hasNormalizedBaseline: boolean;
};

export default function SuggestionsPanel(props: Props) {
  const {
    open,
    onClose,
    suggestions,
    rawText,
    normalizedText,
    onApplyRaw,
    onApplyNormalized,
    onApplyAllRaw,
    onApplyAllNormalized,
    onRevertRaw,
    onRevertNormalized,
    hasRawBaseline,
    hasNormalizedBaseline,
  } = props;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-40 transition-opacity duration-200",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <aside
        className={[
          "fixed right-0 top-0 z-50 h-full w-full max-w-lg",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="h-full border-l border-white/10 bg-gradient-to-b from-slate-950/85 to-slate-900/85 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Layout Optimizer</div>
              <div className="text-xs text-white/60">
                Suggestions only - apply/revert
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="h-[calc(100vh-4rem)] space-y-3 overflow-auto px-5 py-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="text-xs font-semibold text-white/80">Bulk actions</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={onApplyAllRaw}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Apply all to Editor
                </button>
                <button
                  onClick={onApplyAllNormalized}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Apply all to Output
                </button>

                <button
                  onClick={onRevertRaw}
                  disabled={!hasRawBaseline}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-white/5"
                >
                  Revert Editor
                </button>
                <button
                  onClick={onRevertNormalized}
                  disabled={!hasNormalizedBaseline}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-white/5"
                >
                  Revert Output
                </button>
              </div>
              <div className="mt-2 text-xs text-white/50">
                Editor changes what you pasted. Output keeps editor unchanged and
                overrides normalized formatting.
              </div>
            </div>

            <div className="text-xs text-white/60">
              Suggestions found:{" "}
              <span className="font-semibold text-white/90">{suggestions.length}</span>
            </div>

            {suggestions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 backdrop-blur-xl">
                No suggestions right now.
              </div>
            ) : (
              suggestions.map((s) => {
                const show = expandedId === s.id;
                const rawPatch = s.patches.find((p) => p.target === "raw");
                const normPatch = s.patches.find((p) => p.target === "normalized");
                const rawApplied = rawPatch ? rawPatch.apply(rawText) === rawText : false;
                const outputApplied = normPatch
                  ? normPatch.apply(normalizedText) === normalizedText
                  : false;
                const previewPatch = rawPatch ?? normPatch;
                const previewBaseText = rawPatch ? rawText : normalizedText;
                const preview = previewPatch
                  ? computePreview(previewBaseText, previewPatch.apply)
                  : { before: "", after: "" };
                const diffs = show
                  ? {
                      raw: rawPatch ? makeLineDiff(rawText, rawPatch.apply(rawText)) : null,
                      normalized: normPatch
                        ? makeLineDiff(normalizedText, normPatch.apply(normalizedText))
                        : null,
                    }
                  : null;

                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{s.title}</div>
                        <div className="mt-1 text-xs text-white/60">{s.rationale}</div>
                      </div>

                      <button
                        onClick={() => setExpandedId(show ? null : s.id)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
                      >
                        {show ? "Hide diff" : "View diff"}
                      </button>
                    </div>

                    {previewPatch ? (
                      <div className="mt-3 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                          Before
                        </div>
                        <div className="rounded border border-red-500 bg-red-950/40 p-2 font-mono text-xs text-red-100">
                          {preview.before || <span className="text-white/50">(no change)</span>}
                        </div>

                        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                          After
                        </div>
                        <div className="rounded border border-emerald-500 bg-emerald-950/40 p-2 font-mono text-xs text-emerald-100">
                          {preview.after || <span className="text-white/50">(no change)</span>}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onApplyRaw(s)}
                        disabled={!rawPatch || rawApplied}
                        className={[
                          "rounded-xl px-3 py-2 text-xs transition disabled:opacity-40",
                          rawApplied
                            ? "border border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                            : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white disabled:hover:bg-white/5",
                        ].join(" ")}
                      >
                        {rawApplied ? "Applied" : "Apply to Editor"}
                      </button>
                      <button
                        onClick={() => onApplyNormalized(s)}
                        disabled={!normPatch || outputApplied}
                        className={[
                          "rounded-xl px-3 py-2 text-xs transition disabled:opacity-40",
                          outputApplied
                            ? "border border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                            : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white disabled:hover:bg-white/5",
                        ].join(" ")}
                      >
                        {outputApplied ? "Applied" : "Apply to Output"}
                      </button>
                    </div>

                    {show ? (
                      <div className="mt-4 space-y-3">
                        {diffs?.raw ? (
                          <>
                            <div className="text-xs font-semibold text-white/80">
                              Editor diff
                            </div>
                            <DiffViewer lines={diffs.raw} />
                          </>
                        ) : null}

                        {diffs?.normalized ? (
                          <>
                            <div className="text-xs font-semibold text-white/80">
                              Output diff
                            </div>
                            <DiffViewer lines={diffs.normalized} />
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
