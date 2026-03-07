"use client";

import type { ReactNode } from "react";

export type MarginPreset = "compact" | "normal" | "spacious";
export type Theme = "whitepaper" | "dev" | "academic";
export type TablePreset = "equal" | "wide-first" | "wide-middle";

type Props = {
  open: boolean;
  onClose: () => void;

  title: string;
  setTitle: (v: string) => void;

  theme: Theme;
  setTheme: (v: Theme) => void;

  includeToc: boolean;
  setIncludeToc: (v: boolean) => void;

  tocDepth: 2 | 3 | 4;
  setTocDepth: (v: 2 | 3 | 4) => void;

  marginPreset: MarginPreset;
  setMarginPreset: (v: MarginPreset) => void;

  tablePreset: TablePreset;
  setTablePreset: (v: TablePreset) => void;

  inferSemanticHeadings: boolean;
  setInferSemanticHeadings: (v: boolean) => void;
};

function GlassCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      {children}
    </div>
  );
}

export default function SettingsPanel(props: Props) {
  const {
    open,
    onClose,
    title,
    setTitle,
    theme,
    setTheme,
    includeToc,
    setIncludeToc,
    tocDepth,
    setTocDepth,
    marginPreset,
    setMarginPreset,
    tablePreset,
    setTablePreset,
    inferSemanticHeadings,
    setInferSemanticHeadings,
  } = props;

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
          "fixed right-0 top-0 z-50 h-full w-full max-w-md",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className="h-full border-l border-white/10 bg-gradient-to-b from-slate-950/85 to-slate-900/85 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Export Settings</div>
              <div className="text-xs text-white/60">A4 - Deterministic output</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="space-y-4 overflow-auto px-5 py-5">
            <GlassCard>
              <label className="block text-xs font-semibold text-white/80">
                Document title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mark-Down Document"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/10"
              />
              <p className="mt-2 text-xs text-white/50">
                Used in PDF filename and footer.
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/80">Theme</div>
                  <div className="text-xs text-white/50">
                    Affects typography + spacing
                  </div>
                </div>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/10"
                >
                  <option value="whitepaper">Whitepaper</option>
                  <option value="dev">Developer Docs</option>
                  <option value="academic">Academic</option>
                </select>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/80">
                    Table of contents
                  </div>
                  <div className="text-xs text-white/50">
                    Auto-generated from headings
                  </div>
                </div>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeToc}
                    onChange={(e) => setIncludeToc(e.target.checked)}
                    className="h-4 w-4 accent-white"
                  />
                  <span className="text-xs text-white/70">Include</span>
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-white/60">TOC depth</div>
                <select
                  value={tocDepth}
                  onChange={(e) => setTocDepth(Number(e.target.value) as 2 | 3 | 4)}
                  disabled={!includeToc}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/10 disabled:opacity-50"
                >
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                  <option value={4}>H4</option>
                </select>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="text-xs font-semibold text-white/80">Margins</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["compact", "normal", "spacious"] as const).map((p) => {
                  const active = marginPreset === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setMarginPreset(p)}
                      className={[
                        "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                        active
                          ? "border-white/25 bg-white/15 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                    >
                      {p === "compact"
                        ? "Compact"
                        : p === "normal"
                          ? "Normal"
                          : "Spacious"}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-white/50">
                Compact fits more content. Spacious improves readability.
              </p>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/80">Table layout</div>
                  <div className="text-xs text-white/50">PDF column width preset</div>
                </div>
                <select
                  value={tablePreset}
                  onChange={(e) => setTablePreset(e.target.value as TablePreset)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/10"
                >
                  <option value="equal">Equal</option>
                  <option value="wide-first">Wide first column</option>
                  <option value="wide-middle">Wide middle column</option>
                </select>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/80">
                    Infer semantic headings
                  </div>
                  <div className="text-xs text-white/50">
                    Detect headings from plain-text structured docs
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInferSemanticHeadings(!inferSemanticHeadings)}
                  className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                    inferSemanticHeadings
                      ? "border-white/20 bg-white/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  {inferSemanticHeadings ? "On" : "Off"}
                </button>
              </div>
            </GlassCard>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="text-xs font-semibold text-white/80">Tip</div>
              <div className="mt-1 text-xs text-white/60">
                PDF output matches preview styling closely. For best results, keep
                headings structured.
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
