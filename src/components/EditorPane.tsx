"use client";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onLoadSample: (sampleId: string) => void;
};

export default function EditorPane({ value, onChange, onLoadSample }: Props) {
  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-semibold">Editor</div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Load sample</label>
          <select
            className="rounded-md border bg-white px-2 py-1 text-sm"
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
            <option value="mermaid">Mermaid Diagram</option>
          </select>
        </div>
      </div>

      <div className="flex-1 p-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste your ChatGPT / Markdown-like documentation here…"
          className="h-full w-full resize-none rounded-lg border bg-white p-3 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-black/10"
          spellCheck={false}
        />
      </div>

      <div className="border-t px-3 py-2 text-xs text-gray-500">
        Phase 1: layout shell. Parsing/formatting comes in Phase 3+.
      </div>
    </section>
  );
}
