"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DocumentMap from "@/components/DocumentMap";
import EditorPane from "@/components/EditorPane";
import NotificationBar, { type Notice } from "@/components/NotificationBar";
import PreviewPane from "@/components/PreviewPane";
import SettingsPanel, {
  type MarginPreset,
  type TablePreset,
  type Theme,
} from "@/components/SettingsPanel";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import TopBar from "@/components/TopBar";
import type { DocHeading, DocState } from "@/lib/docModel";
import { extractDocDiagnostics, type DocDiagnostics } from "@/lib/docDiagnostics";
import { normalizeInput } from "@/lib/normalize";
import { parseMarkdownToHtml } from "@/lib/parse";
import {
  resolveExternalDocTitle,
  SCHEMA_VERSION,
  toExternalDiagnostics,
  toExternalIntelligence,
} from "@/lib/payloadContract";
import { clearSession, loadSession, saveSession } from "@/lib/sessionStore";
import { SAMPLES } from "@/lib/samples";
import { generateSuggestions } from "@/lib/suggestions/engine";
import type { Suggestion } from "@/lib/suggestions/types";
import type { DocIntelligence, DocStructuralGroup } from "@/lib/docIntelligence";

export default function HomePage() {
  const router = useRouter();
  const [rawText, setRawText] = useState<string>("");
  const [showNormalized, setShowNormalized] = useState<boolean>(false);

  const [theme, setTheme] = useState<Theme>("whitepaper");
  const [includeToc, setIncludeToc] = useState<boolean>(true);
  const [tocDepth, setTocDepth] = useState<2 | 3 | 4>(3);
  const [inferSemanticHeadings, setInferSemanticHeadings] = useState<boolean>(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("Mark-Down Document");
  const [marginPreset, setMarginPreset] = useState<MarginPreset>("normal");
  const [tablePreset, setTablePreset] = useState<TablePreset>("equal");

  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [normalizedOverride, setNormalizedOverride] = useState<string | null>(null);
  const [rawBaseline, setRawBaseline] = useState<string | null>(null);
  const [normBaseline, setNormBaseline] = useState<string | null>(null);

  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [headings, setHeadings] = useState<DocHeading[]>([]);
  const [intelligence, setIntelligence] = useState<DocIntelligence | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<DocStructuralGroup | null>(null);
  const [showDocMap, setShowDocMap] = useState<boolean>(true);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string>("document.pdf");

  const [notice, setNotice] = useState<Notice | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const { normalizedText, notes, stats } = useMemo(
    () => normalizeInput(rawText, { inferSemanticHeadings }),
    [rawText, inferSemanticHeadings],
  );

  const effectiveNormalized = normalizedOverride ?? normalizedText;

  useEffect(() => {
    const s = loadSession();
    if (!s) return;

    setRawText(s.rawText ?? "");
    setNormalizedOverride(s.normalizedOverride ?? null);
    setTheme(s.theme ?? "whitepaper");
    setIncludeToc(!!s.includeToc);
    setTocDepth((s.tocDepth ?? 3) as 2 | 3 | 4);
    setDocTitle(s.docTitle ?? "Mark-Down Document");
    setMarginPreset((s.marginPreset ?? "normal") as MarginPreset);
    setTablePreset((s.tablePreset ?? "equal") as TablePreset);
    clearSession();
  }, []);

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
          setIntelligence(res.intelligence);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Parse error";
          setParseError(message);
          setRenderedHtml("");
          setHeadings([]);
          setIntelligence(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveNormalized, includeToc, tocDepth]);

  useEffect(() => {
    setSuggestions(generateSuggestions(rawText, normalizedText, intelligence ?? undefined));
  }, [rawText, normalizedText, intelligence]);

  const diagnostics: DocDiagnostics = useMemo(
    () =>
      extractDocDiagnostics({
        rawText,
        normalizedText: effectiveNormalized,
        notes,
        stats,
        renderedHtml,
        headings,
        intelligence,
      }),
    [rawText, effectiveNormalized, notes, stats, renderedHtml, headings, intelligence],
  );

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const resolveHeadingEls = useCallback(
    (scroller: HTMLDivElement): HTMLElement[] => {
      return headings
        .map((h) => scroller.querySelector<HTMLElement>(`#${CSS.escape(h.id)}`))
        .filter((el): el is HTMLElement => !!el);
    },
    [headings],
  );

  useEffect(() => {
    const scroller = previewScrollRef.current;
    if (!scroller || headings.length === 0 || showNormalized) {
      setActiveHeadingId(null);
      return;
    }
    const activeScroller: HTMLDivElement = scroller;

    function onScroll() {
      const headingEls = resolveHeadingEls(activeScroller);
      if (headingEls.length === 0) {
        setActiveHeadingId(null);
        return;
      }

      let current: string | null = null;
      for (const el of headingEls) {
        if (el.offsetTop - activeScroller.scrollTop <= 80) {
          current = el.id;
        }
      }

      setActiveHeadingId(current ?? headingEls[0]?.id ?? null);
    }

    onScroll();
    activeScroller.addEventListener("scroll", onScroll, { passive: true });
    return () => activeScroller.removeEventListener("scroll", onScroll);
  }, [headings, renderedHtml, resolveHeadingEls, showNormalized]);

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
          tablePreset,
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

  function handleDownloadIntelligenceJson() {
    const externalIntelligence = toExternalIntelligence(intelligence);
    const externalDiagnostics = toExternalDiagnostics(diagnostics);
    const externalDocTitle = resolveExternalDocTitle(externalIntelligence);

    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        app: "Mark-Down",
        version: "0.1.0",
        schemaVersion: SCHEMA_VERSION,
      },
      input: {
        rawText,
        normalizedText: effectiveNormalized ?? rawText,
        docTitle: externalDocTitle,
        inferSemanticHeadings,
      },
      normalization: {
        notes,
        stats,
      },
      intelligence: externalIntelligence,
      diagnostics: externalDiagnostics,
      parse: {
        parseError: parseError ?? null,
      },
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `doc_intelligence_${timestamp}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  function handleEditPreview() {
    saveSession({
      rawText,
      normalizedOverride,
      theme,
      includeToc,
      tocDepth,
      docTitle,
      marginPreset,
      tablePreset,
    });
    router.push("/edit");
  }

  return (
    <div className="min-h-screen text-white">
      <TopBar
        onGeneratePdf={handleGeneratePdf}
        onDownloadPdf={handleDownloadPdf}
        onExportJson={handleDownloadIntelligenceJson}
        onEditPreview={handleEditPreview}
        onToggleSettings={() => setSettingsOpen(true)}
        onToggleOptimizer={() => setOptimizerOpen(true)}
        onToggleDocMap={() => setShowDocMap((v) => !v)}
        isGenerating={isGenerating}
        hasPdf={!!pdfUrl}
        suggestionCount={suggestions.length}
        statusText={statusText}
        showDocMap={showDocMap}
      />

      <NotificationBar notice={notice} onClose={() => setNotice(null)} />

      <main className="mx-auto grid max-w-[1840px] grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[1.05fr_1.05fr_360px]">
        <div className="doc-card h-[calc(100vh-8rem)] overflow-hidden">
          <EditorPane
            value={docState.rawText}
            onChange={setRawText}
            onLoadSample={(id) => setRawText(SAMPLES[id] ?? "")}
          />
        </div>

        <div className="doc-card h-[calc(100vh-8rem)] overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="text-sm font-semibold text-white/90">Preview</div>

              <label className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showNormalized}
                  onChange={(e) => setShowNormalized(e.target.checked)}
                />
                Show processed text
              </label>
            </div>
            {parseError ? (
              <div className="mx-3 mt-2 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <div className="font-semibold text-amber-200">Preview warning</div>
                <div className="mt-1">Could not fully parse the document: {parseError}</div>
              </div>
            ) : null}
            {!showNormalized && intelligence && !showDocMap ? (
              <div className="mx-3 mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200">
                <div className="font-semibold text-white/90">Document Intelligence</div>
                <div className="mt-1">
                  Headings: {intelligence.stats.headings} • Code:{" "}
                  {intelligence.stats.codeBlocks} • Commands:{" "}
                  {intelligence.stats.commandBlocks} • Tables:{" "}
                  {intelligence.stats.tables} • Diagrams:{" "}
                  {intelligence.stats.diagrams} • Procedures:{" "}
                  {intelligence.stats.procedures} • Callouts:{" "}
                  {intelligence.stats.callouts}
                </div>
              </div>
            ) : null}

            {showNormalized ? (
              <div className="flex-1 overflow-auto p-3">
                <div className="normalized-panel rounded-xl border border-white/10 bg-slate-900/70 p-3 text-slate-200">
                  <div className="mb-2 text-xs font-semibold text-slate-100">
                    Normalizer notes
                  </div>
                  <ul className="mb-3 list-disc pl-5 text-xs text-slate-300">
                    {notes.length === 0 ? (
                      <li>None</li>
                    ) : (
                      notes.map((n, i) => <li key={i}>{n}</li>)
                    )}
                  </ul>
                  <div className="mb-2 text-xs text-slate-300">
                    <span className="font-semibold">Stats:</span> fences=
                    {stats.fencesAutoClosed}, headings={stats.headingsFixed},
                    bullets={stats.bulletsNormalized}, numbering=
                    {stats.numberingNormalized}, cmdBlocks=
                    {stats.commandBlocksCreated}, mermaid=
                    {stats.mermaidBlocksCreated}, tables=
                    {stats.tablesConverted}
                  </div>
                  <div className="mb-2 text-xs text-slate-400">
                    Headings detected: {intelligence?.stats.headings ?? docState.headings.length}
                    {parseError ? ` | Parse error: ${parseError}` : ""}
                  </div>
                  <div className="mb-2 text-xs font-semibold text-slate-100">
                    Effective normalized text
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs leading-5">
                    {docState.normalizedText}
                  </pre>
                </div>
              </div>
            ) : (
              <PreviewPane
                renderedHtml={docState.renderedPreview}
                theme={theme}
                previewScrollRef={previewScrollRef}
                activeGroup={activeGroup}
              />
            )}
          </div>
        </div>

        {showDocMap ? (
          <div className="h-[calc(100vh-8.25rem)] overflow-hidden">
            <DocumentMap
              intelligence={intelligence}
              diagnostics={diagnostics}
              previewScrollRef={previewScrollRef}
              activeHeadingId={activeHeadingId}
              activeGroup={activeGroup}
              onSelectGroup={setActiveGroup}
            />
          </div>
        ) : null}
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
        tablePreset={tablePreset}
        setTablePreset={setTablePreset}
        inferSemanticHeadings={inferSemanticHeadings}
        setInferSemanticHeadings={setInferSemanticHeadings}
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

