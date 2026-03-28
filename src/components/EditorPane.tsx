"use client";

import Editor from "@monaco-editor/react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onLoadSample: (sampleId: string) => void;
};

export default function EditorPane({ value, onChange, onLoadSample }: Props) {
  const isEmpty = value.trim().length === 0;

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-semibold text-white/90">Editor</div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-white/70">Load sample</label>
          <select
            className="rounded-md border border-white/20 bg-slate-900 px-2 py-1 text-sm text-white"
            defaultValue="none"
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "none") onLoadSample(v);
              e.currentTarget.value = "none";
            }}
          >
            <option value="none">-</option>
            <option value="basic">Basic Markdown</option>
            <option value="chatgpt">ChatGPT-ish Messy</option>
            <option value="tables">Tables + Lists</option>
            <option value="tables2">Tables v2 (raw formats)</option>
            <option value="mermaid">Mermaid Diagram</option>
            <option value="smart_logistics">Smart Logistics Demo</option>
          </select>
        </div>
      </div>

      <div className="border-b border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
        Paste or write your text -&gt; See structured output instantly
      </div>

      <div className="relative flex-1">
        {isEmpty ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/55 p-6">
            <div className="max-w-md rounded-2xl border border-white/15 bg-black/35 px-6 py-8 text-center backdrop-blur-xl">
              <div className="text-xl font-semibold text-white">Paste your text to start</div>
              <div className="mt-2 text-sm text-white/70">
                Mark-Down will structure your document automatically
              </div>
              <button
                type="button"
                className="mt-5 rounded-xl border border-indigo-300/30 bg-indigo-500/30 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500/40"
                onClick={() => onLoadSample("smart_logistics")}
              >
                Load example
              </button>
            </div>
          </div>
        ) : null}

        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          options={{
            wordWrap: "on",
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 20,
            tabSize: 2,
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            automaticLayout: true,
          }}
        />
      </div>
    </section>
  );
}
