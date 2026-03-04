type Props = {
  onGeneratePdf: () => void;
  onDownloadPdf: () => void;
  isGenerating: boolean;
  hasPdf: boolean;
};

export default function TopBar({
  onGeneratePdf,
  onDownloadPdf,
  isGenerating,
  hasPdf,
}: Props) {
  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-black" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Mark-Down</div>
            <div className="text-xs text-gray-500">{"ChatGPT doc -> PDF"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onGeneratePdf}
            disabled={isGenerating}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            title="Generate a PDF from current document"
          >
            {isGenerating ? "Generating..." : "Generate PDF"}
          </button>

          <button
            onClick={onDownloadPdf}
            disabled={!hasPdf || isGenerating}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            title={hasPdf ? "Download the latest PDF" : "Generate a PDF first"}
          >
            Download
          </button>

          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            title="Settings (later)"
          >
            Settings
          </button>
        </div>
      </div>
    </header>
  );
}
