"use client";

import { useEffect, useMemo, useState } from "react";
import EditorPane from "@/components/EditorPane";
import NotificationBar, { type Notice } from "@/components/NotificationBar";
import PreviewPane from "@/components/PreviewPane";
import SettingsPanel, {
  type MarginPreset,
  type Theme,
} from "@/components/SettingsPanel";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import TopBar from "@/components/TopBar";
import type { DocHeading, DocState } from "@/lib/docModel";
import { normalizeInput } from "@/lib/normalize";
import { parseMarkdownToHtml } from "@/lib/parse";
import { SAMPLES } from "@/lib/samples";
import { generateSuggestions } from "@/lib/suggestions/engine";
import type { Suggestion } from "@/lib/suggestions/types";

export default function HomePage() {
  const [rawText, setRawText] = useState<string>("");
  const [showNormalized, setShowNormalized] = useState<boolean>(false);

  const [theme, setTheme] = useState<Theme>("whitepaper");
  const [includeToc, setIncludeToc] = useState<boolean>(true);
  const [tocDepth, setTocDepth] = useState<2 | 3 | 4>(3);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("Mark-Down Document");
  const [marginPreset, setMarginPreset] = useState<MarginPreset>("normal");

  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [normalizedOverride, setNormalizedOverride] = useState<string | null>(null);
  const [rawBaseline, setRawBaseline] = useState<string | null>(null);
  const [normBaseline, setNormBaseline] = useState<string | null>(null);

  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [headings, setHeadings] = useState<DocHeading[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string>("document.pdf");

  const [notice, setNotice] = useState<Notice | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const { normalizedText, notes, stats } = useMemo(
    () => normalizeInput(rawText),
    [rawText],
  );

  const effectiveNormalized = normalizedOverride ?? normalizedText;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setParseError(null);
        const res = await parseMarkdownToHtml(effectiveNormalized, {
          includeToc,
          tocMaxDepth: tocDepth,
        });
        if (!cancelled) {
          setRenderedHtml(res.html);
          setHeadings(res.headings);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Parse error";
          setParseError(message);
          setRenderedHtml("");
          setHeadings([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveNormalized, includeToc, tocDepth]);

  useEffect(() => {
    setSuggestions(generateSuggestions(rawText, normalizedText));
  }, [rawText, normalizedText]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const docState: DocState = useMemo(
    () => ({
      rawText,
      normalizedText: effectiveNormalized,
      headings,
      renderedPreview: renderedHtml,
    }),
    [rawText, effectiveNormalized, headings, renderedHtml],
  );

  function applySuggestionToRaw(s: Suggestion) {
    const p = s.patches.find((x) => x.target === "raw");
    if (!p) return;

    if (rawBaseline === null) setRawBaseline(rawText);

    const next = p.apply(rawText);
    setRawText(next);
  }

  function applySuggestionToNormalized(s: Suggestion) {
    const p = s.patches.find((x) => x.target === "normalized");
    if (!p) return;

    if (normBaseline === null) setNormBaseline(effectiveNormalized);

    const next = p.apply(effectiveNormalized);
    setNormalizedOverride(next);
  }

  function applyAllRaw() {
    if (suggestions.length === 0) return;
    if (rawBaseline === null) setRawBaseline(rawText);

    let t = rawText;
    for (const s of suggestions) {
      const p = s.patches.find((x) => x.target === "raw");
      if (p) t = p.apply(t);
    }
    setRawText(t);
  }

  function applyAllNormalized() {
    if (suggestions.length === 0) return;
    if (normBaseline === null) setNormBaseline(effectiveNormalized);

    let t = effectiveNormalized;
    for (const s of suggestions) {
      const p = s.patches.find((x) => x.target === "normalized");
      if (p) t = p.apply(t);
    }
    setNormalizedOverride(t);
  }

  function revertRaw() {
    if (rawBaseline === null) return;
    setRawText(rawBaseline);
    setRawBaseline(null);
  }

  function revertNormalized() {
    if (normBaseline === null) return;
    setNormalizedOverride(normBaseline);
    setNormBaseline(null);
  }

  async function handleGeneratePdf() {
    if (!rawText.trim()) {
      setNotice({
        type: "error",
        message: "Nothing to export. Paste content first.",
      });
      return;
    }

    setIsGenerating(true);
    setStatusText("Generating PDF...");
    setNotice({ type: "info", message: "Generating PDF..." });

    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);

      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: effectiveNormalized,
          title: docTitle,
          theme,
          includeToc,
          tocDepth,
          marginPreset,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "PDF API failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setPdfUrl(url);
      setPdfName(`${docTitle.replace(/\s+/g, "_")}.pdf`);

      const kb = Math.round(blob.size / 1024);
      setNotice({ type: "success", message: `PDF ready (${kb} KB).` });
      setStatusText(`PDF ready (${kb} KB)`);
    } catch (e: unknown) {
      setPdfUrl(null);
      const message = e instanceof Error ? e.message : "PDF generation failed";
      setNotice({ type: "error", message });
      setStatusText("PDF failed");
    } finally {
      setIsGenerating(false);
      setTimeout(() => setStatusText(null), 3500);
    }
  }

  function handleDownloadPdf() {
    if (!pdfUrl) {
      setNotice({ type: "info", message: "Generate a PDF first." });
      return;
    }
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = pdfName;
    a.click();
  }

  return (
    <div className="min-h-screen text-white">
      <TopBar
        onGeneratePdf={handleGeneratePdf}
        onDownloadPdf={handleDownloadPdf}
        onToggleSettings={() => setSettingsOpen(true)}
        onToggleOptimizer={() => setOptimizerOpen(true)}
        isGenerating={isGenerating}
        hasPdf={!!pdfUrl}
        suggestionCount={suggestions.length}
        statusText={statusText}
      />

      <NotificationBar notice={notice} onClose={() => setNotice(null)} />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-2">
        <div className="h-[calc(100vh-8.8rem)] overflow-hidden rounded-2xl border border-white/10 bg-white/95 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
          <EditorPane
            value={docState.rawText}
            onChange={setRawText}
            onLoadSample={(id) => setRawText(SAMPLES[id] ?? "")}
          />
        </div>

        <div className="h-[calc(100vh-8.8rem)] overflow-hidden rounded-2xl border border-white/10 bg-white/95 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="text-sm font-semibold text-gray-800">Preview</div>

              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showNormalized}
                  onChange={(e) => setShowNormalized(e.target.checked)}
                />
                Show normalized
              </label>
            </div>

            {showNormalized ? (
              <div className="flex-1 overflow-auto bg-gray-50 p-3">
                <div className="rounded-lg border bg-white p-3">
                  <div className="mb-2 text-xs font-semibold text-gray-700">
                    Normalizer notes
                  </div>
                  <ul className="mb-3 list-disc pl-5 text-xs text-gray-600">
                    {notes.length === 0 ? (
                      <li>None</li>
                    ) : (
                      notes.map((n, i) => <li key={i}>{n}</li>)
                    )}
                  </ul>
                  <div className="mb-2 text-xs text-gray-600">
                    <span className="font-semibold">Stats:</span> fences=
                    {stats.fencesAutoClosed}, headings={stats.headingsFixed},
                    bullets={stats.bulletsNormalized}, numbering=
                    {stats.numberingNormalized}, cmdBlocks=
                    {stats.commandBlocksCreated}, mermaid=
                    {stats.mermaidBlocksCreated}, tables=
                    {stats.tablesConverted}
                  </div>
                  <div className="mb-2 text-xs text-gray-500">
                    Headings detected: {docState.headings.length}
                    {parseError ? ` | Parse error: ${parseError}` : ""}
                  </div>
                  <div className="mb-2 text-xs font-semibold text-gray-700">
                    Effective normalized text
                  </div>
                  <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 text-xs leading-5">
                    {docState.normalizedText}
                  </pre>
                </div>
              </div>
            ) : (
              <PreviewPane renderedHtml={docState.renderedPreview} theme={theme} />
            )}
          </div>
        </div>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={docTitle}
        setTitle={setDocTitle}
        theme={theme}
        setTheme={setTheme}
        includeToc={includeToc}
        setIncludeToc={setIncludeToc}
        tocDepth={tocDepth}
        setTocDepth={setTocDepth}
        marginPreset={marginPreset}
        setMarginPreset={setMarginPreset}
      />

      <SuggestionsPanel
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
        suggestions={suggestions}
        rawText={rawText}
        normalizedText={effectiveNormalized}
        onApplyRaw={applySuggestionToRaw}
        onApplyNormalized={applySuggestionToNormalized}
        onApplyAllRaw={applyAllRaw}
        onApplyAllNormalized={applyAllNormalized}
        onRevertRaw={revertRaw}
        onRevertNormalized={revertNormalized}
        hasRawBaseline={rawBaseline !== null}
        hasNormalizedBaseline={normBaseline !== null}
      />
    </div>
  );
}