"use client";

import Editor from "@monaco-editor/react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onLoadSample: (sampleId: string) => void;
};

export default function EditorPane({ value, onChange, onLoadSample }: Props) {
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
            <option value="none">—</option>
            <option value="basic">Basic Markdown</option>
            <option value="chatgpt">ChatGPT-ish Messy</option>
            <option value="tables">Tables + Lists</option>
            <option value="tables2">Tables v2 (raw formats)</option>
            <option value="mermaid">Mermaid Diagram</option>
          </select>
        </div>
      </div>

      <div className="flex-1">
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
