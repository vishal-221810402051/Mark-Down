"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";

import PreviewPane from "@/components/PreviewPane";
import { normalizeInput } from "@/lib/normalize";
import { parseMarkdownToHtml } from "@/lib/parse";
import { loadSession, saveSession } from "@/lib/sessionStore";

type Action =
  | "codeblock"
  | "inlinecode"
  | "h2"
  | "h3"
  | "h4"
  | "blockquote"
  | "ul"
  | "ol";

function applyToSelection(
  text: string,
  selection: { start: number; end: number },
  action: Action,
): string {
  const before = text.slice(0, selection.start);
  const sel = text.slice(selection.start, selection.end);
  const after = text.slice(selection.end);
  const trimmed = sel.replace(/\s+$/g, "");
  const suffix = sel.slice(trimmed.length);

  switch (action) {
    case "inlinecode":
      return before + "`" + trimmed + "`" + suffix + after;
    case "codeblock": {
      const lang = guessBlockLang(trimmed);
      return before + "\n```" + lang + "\n" + trimmed + "\n```\n" + suffix + after;
    }
    case "blockquote": {
      const lines = trimmed.split("\n").map((l) => {
        const clean = l.replace(/^\s*>\s?/, "");
        return clean.trim() ? `> ${clean}` : ">";
      });
      return before + lines.join("\n") + suffix + after;
    }
    case "ul": {
      const lines = trimmed.split("\n").map((l) => {
        const clean = l.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, "").trim();
        return clean ? `- ${clean}` : "";
      });
      return before + lines.join("\n") + suffix + after;
    }
    case "ol": {
      let n = 1;
      const lines = trimmed.split("\n").map((l) => {
        const clean = l.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, "").trim();
        if (!clean) return "";
        return `${n++}. ${clean}`;
      });
      return before + lines.join("\n") + suffix + after;
    }
    case "h2":
    case "h3":
    case "h4": {
      const level = action === "h2" ? "##" : action === "h3" ? "###" : "####";
      const lines = trimmed.split("\n");
      const idx = lines.findIndex((l) => l.trim().length > 0);
      if (idx === -1) return text;
      lines[idx] = `${level} ${lines[idx].replace(/^#{1,6}\s+/, "").trim()}`;
      return before + lines.join("\n") + suffix + after;
    }
  }
}

function guessBlockLang(sel: string): string {
  const s = sel.trim();
  if (/^(npm|pnpm|yarn|docker|git|curl|wget)\b/m.test(s)) return "bash";
  if (/^(PS [A-Z]:\\|[A-Z]:\\.*>)/m.test(s)) return "powershell";
  if (/\b(function|const|let|var|return|console\.log)\b/.test(s))
    return "javascript";
  if (/\b(def|import|from|class)\b/.test(s)) return "python";
  return "text";
}

export default function EditPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState<"whitepaper" | "dev" | "academic">("whitepaper");
  const [includeToc, setIncludeToc] = useState(true);
  const [tocDepth, setTocDepth] = useState<2 | 3 | 4>(3);
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState("");
  const [renderedHtml, setRenderedHtml] = useState("");
  const [editorSelection, setEditorSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.push("/");
      return;
    }

    const effective = (s.normalizedOverride ?? normalizeInput(s.rawText).normalizedText) ?? "";
    const frame = window.requestAnimationFrame(() => {
      setRawText(s.rawText ?? "");
      setDraft(effective);
      setTheme(s.theme ?? "whitepaper");
      setIncludeToc(!!s.includeToc);
      setTocDepth((s.tocDepth ?? 3) as 2 | 3 | 4);
      setLoaded(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [router]);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;

    (async () => {
      const res = await parseMarkdownToHtml(draft, {
        includeToc,
        tocMaxDepth: tocDepth,
      });
      if (!cancelled) setRenderedHtml(res.html);
    })();

    return () => {
      cancelled = true;
    };
  }, [draft, includeToc, tocDepth, loaded]);

  function onAction(action: Action) {
    if (!editorSelection) return;
    setDraft((prev) => applyToSelection(prev, editorSelection, action));
  }

  function onSave() {
    const s = loadSession();
    if (!s) {
      router.push("/");
      return;
    }

    saveSession({
      ...s,
      rawText,
      normalizedOverride: draft,
      theme,
      includeToc,
      tocDepth,
    });
    router.push("/");
  }

  if (!loaded) return null;

  return (
    <div className="min-h-screen text-white">
      <header className="sticky top-0 z-[100] border-b border-white/10 bg-gradient-to-r from-slate-950/80 to-slate-900/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between px-6">
          <div className="text-sm font-semibold">Edit Preview</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="rounded-xl border border-white/15 bg-white/15 px-3 py-1.5 text-sm text-white transition hover:bg-white/20"
            >
              Save
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-2">
        <div className="h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="text-sm font-semibold text-white/90">
              Source (Output override)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                onClick={() => onAction("codeblock")}
                title="Convert selection to fenced code block"
              >
                Code
              </button>
              <button
                className="btn"
                onClick={() => onAction("inlinecode")}
                title="Convert selection to inline code"
              >
                Inline
              </button>
              <button
                className="btn"
                onClick={() => onAction("blockquote")}
                title="Convert selection to blockquote"
              >
                Quote
              </button>
              <button
                className="btn"
                onClick={() => onAction("ul")}
                title="Convert selection to bullet list"
              >
                Bullet
              </button>
              <button
                className="btn"
                onClick={() => onAction("ol")}
                title="Convert selection to numbered list"
              >
                Number
              </button>
              <button className="btn" onClick={() => onAction("h2")}>
                H2
              </button>
              <button className="btn" onClick={() => onAction("h3")}>
                H3
              </button>
              <button className="btn" onClick={() => onAction("h4")}>
                H4
              </button>
            </div>
          </div>
          <Editor
            theme="vs-dark"
            height="100%"
            defaultLanguage="markdown"
            value={draft}
            onChange={(v) => setDraft(v ?? "")}
            onMount={(editor) => {
              editor.onDidChangeCursorSelection(() => {
                const sel = editor.getSelection();
                if (!sel) {
                  setEditorSelection(null);
                  return;
                }

                const model = editor.getModel();
                if (!model) {
                  setEditorSelection(null);
                  return;
                }

                const start = model.getOffsetAt(sel.getStartPosition());
                const end = model.getOffsetAt(sel.getEndPosition());
                if (start === end) {
                  setEditorSelection(null);
                  return;
                }

                setEditorSelection({
                  start: Math.min(start, end),
                  end: Math.max(start, end),
                });
              });
            }}
            options={{
              wordWrap: "on",
              minimap: { enabled: false },
              fontSize: 14,
              lineHeight: 22,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        <div className="h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <PreviewPane renderedHtml={renderedHtml} theme={theme} />
        </div>
      </div>

      <style jsx>{`
        .btn {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.85);
          padding: 0.25rem 0.55rem;
          border-radius: 10px;
          font-size: 12px;
          transition: 150ms;
        }
        .btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }
      `}</style>
    </div>
  );
}
