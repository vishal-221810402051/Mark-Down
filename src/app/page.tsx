"use client";

import { useEffect, useMemo, useState } from "react";
import EditorPane from "@/components/EditorPane";
import PreviewPane, { type PreviewTheme } from "@/components/PreviewPane";
import TopBar from "@/components/TopBar";
import type { DocHeading, DocState } from "@/lib/docModel";
import { normalizeInput } from "@/lib/normalize";
import { parseMarkdownToHtml } from "@/lib/parse";
import { SAMPLES } from "@/lib/samples";

export default function HomePage() {
  const [rawText, setRawText] = useState<string>("");
  const [showNormalized, setShowNormalized] = useState<boolean>(false);
  const [theme, setTheme] = useState<PreviewTheme>("whitepaper");
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [headings, setHeadings] = useState<DocHeading[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const { normalizedText, notes, stats } = useMemo(
    () => normalizeInput(rawText),
    [rawText],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setParseError(null);
        const res = await parseMarkdownToHtml(normalizedText);
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
  }, [normalizedText]);

  const docState: DocState = useMemo(
    () => ({
      rawText,
      normalizedText,
      headings,
      renderedPreview: renderedHtml,
    }),
    [rawText, normalizedText, headings, renderedHtml],
  );

  return (
    <div className="min-h-screen bg-white">
      <TopBar />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-2">
        <div className="h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border">
          <EditorPane
            value={docState.rawText}
            onChange={setRawText}
            onLoadSample={(id) => setRawText(SAMPLES[id] ?? "")}
          />
        </div>

        <div className="h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="text-sm font-semibold">Preview</div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Theme</span>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as PreviewTheme)}
                    className="rounded-md border bg-white px-2 py-1 text-xs"
                  >
                    <option value="whitepaper">Whitepaper</option>
                    <option value="dev">Developer Docs</option>
                    <option value="academic">Academic</option>
                  </select>
                </label>

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
                    {stats.mermaidBlocksCreated}
                  </div>
                  <div className="mb-2 text-xs text-gray-500">
                    Headings detected: {docState.headings.length}
                    {parseError ? ` | Parse error: ${parseError}` : ""}
                  </div>
                  <div className="mb-2 text-xs font-semibold text-gray-700">
                    Normalized text
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
    </div>
  );
}
