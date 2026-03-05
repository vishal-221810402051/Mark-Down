import type { ReactNode } from "react";

type Props = {
  onGeneratePdf: () => void;
  onDownloadPdf: () => void;
  onEditPreview: () => void;
  onToggleSettings: () => void;
  onToggleOptimizer: () => void;
  isGenerating: boolean;
  hasPdf: boolean;
  suggestionCount: number;
  statusText?: string | null;
};

function GlassButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "primary" | "secondary";
}) {
  const { children, onClick, disabled, title, variant = "secondary" } = props;

  const base =
    "rounded-xl border px-3 py-1.5 text-sm transition backdrop-blur-xl " +
    "shadow-[0_10px_30px_rgba(0,0,0,0.25)]";

  const styles =
    variant === "primary"
      ? "border-white/15 bg-white/15 text-white hover:bg-white/20"
      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white";

  const disabledStyles =
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${styles} ${disabledStyles}`}
    >
      {children}
    </button>
  );
}

export default function TopBar({
  onGeneratePdf,
  onDownloadPdf,
  onEditPreview,
  onToggleSettings,
  onToggleOptimizer,
  isGenerating,
  hasPdf,
  suggestionCount,
  statusText,
}: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-gradient-to-r from-slate-950/80 to-slate-900/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-2xl bg-white/10 ring-1 ring-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.35)]" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Mark-Down</div>
            <div className="text-xs text-white/60">ChatGPT doc -&gt; PDF</div>
          </div>

          {statusText ? (
            <div className="ml-3 hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-xl md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              {statusText}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            onClick={onGeneratePdf}
            disabled={isGenerating}
            variant="primary"
            title="Generate a PDF from current document"
          >
            {isGenerating ? "Generating..." : "Generate PDF"}
          </GlassButton>

          <GlassButton
            onClick={onDownloadPdf}
            disabled={!hasPdf || isGenerating}
            title={hasPdf ? "Download the latest PDF" : "Generate a PDF first"}
          >
            Download
          </GlassButton>

          <GlassButton onClick={onEditPreview} title="Open preview edit mode">
            Edit Preview
          </GlassButton>

          <GlassButton onClick={onToggleSettings} title="Export settings">
            Settings
          </GlassButton>

          <GlassButton
            onClick={onToggleOptimizer}
            title="Layout optimizer (suggestions)"
          >
            Optimizer {suggestionCount > 0 ? `(${suggestionCount})` : ""}
          </GlassButton>
        </div>
      </div>
    </header>
  );
}
