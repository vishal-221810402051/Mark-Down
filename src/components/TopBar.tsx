import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  onGeneratePdf: () => void;
  onDownloadPdf: () => void;
  onExportJson?: () => void;
  onLoadExample?: () => void;
  onEditPreview: () => void;
  onToggleSettings: () => void;
  onToggleOptimizer: () => void;
  onToggleDocMap?: () => void;
  isGenerating: boolean;
  hasPdf: boolean;
  suggestionCount: number;
  statusText?: string | null;
  showDocMap?: boolean;
};

function GlassButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "primary" | "secondary";
}) {
  const { children, onClick, disabled, title, variant = "secondary" } = props;
  const styles =
    variant === "primary" ? "glass-btn glass-btn-primary" : "glass-btn";
  const disabledStyles = "disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${styles} ${disabledStyles}`}
    >
      {children}
    </button>
  );
}

export default function TopBar({
  onGeneratePdf,
  onDownloadPdf,
  onExportJson,
  onLoadExample,
  onEditPreview,
  onToggleSettings,
  onToggleOptimizer,
  onToggleDocMap,
  isGenerating,
  hasPdf,
  suggestionCount,
  statusText,
  showDocMap,
}: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-gradient-to-r from-slate-950/80 to-slate-900/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <Image
              src="/logo.jpeg"
              alt="Mark-Down logo"
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Mark-Down</div>
            <div className="text-xs text-white/60">From messy text to structured documents</div>
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

          {onExportJson ? (
            <GlassButton
              onClick={onExportJson}
              disabled={isGenerating}
              title="Download full intelligence as JSON"
            >
              Export JSON
            </GlassButton>
          ) : null}

          {onLoadExample ? (
            <GlassButton onClick={onLoadExample} title="Load demo example">
              Load example
            </GlassButton>
          ) : null}

          <GlassButton onClick={onEditPreview} title="Open preview edit mode">
            Edit Preview
          </GlassButton>

          {onToggleDocMap ? (
            <GlassButton onClick={onToggleDocMap} title="Toggle document structure">
              {showDocMap ? "Hide Structure" : "Show Structure"}
            </GlassButton>
          ) : null}

          <GlassButton onClick={onToggleSettings} title="Export settings">
            Settings
          </GlassButton>

          <GlassButton
            onClick={onToggleOptimizer}
            title="Open suggestions"
          >
            Suggestions {suggestionCount > 0 ? `(${suggestionCount})` : ""}
          </GlassButton>
        </div>
      </div>
    </header>
  );
}
