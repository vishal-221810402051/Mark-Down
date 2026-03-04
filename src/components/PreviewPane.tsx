"use client";

type Props = {
  title?: string;
  raw: string;
};

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export default function PreviewPane({ title = "Preview", raw }: Props) {
  // Phase 1: safe preview of text only.
  // Phase 3+: markdown->AST->HTML will replace this.
  const safe = escapeHtml(raw);

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-gray-500">Paper view</div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        {/* A4-like paper container */}
        <div className="mx-auto w-full max-w-[820px] rounded-lg bg-white shadow-sm ring-1 ring-black/5">
          <div className="px-10 py-12">
            {raw.trim().length === 0 ? (
              <div className="text-sm text-gray-400">
                Preview will appear here as you type…
              </div>
            ) : (
              <pre
                className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-gray-900"
                dangerouslySetInnerHTML={{ __html: safe }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="border-t px-3 py-2 text-xs text-gray-500">
        Phase 1: text preview only (safe). Phase 3: real formatting pipeline.
      </div>
    </section>
  );
}
