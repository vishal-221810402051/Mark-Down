"use client";

type Props = {
  title?: string;
  renderedHtml: string; // sanitized HTML
};

export default function PreviewPane({ title = "Preview", renderedHtml }: Props) {
  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-gray-500">Paper view</div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <div className="mx-auto w-full max-w-[820px] rounded-lg bg-white shadow-sm ring-1 ring-black/5">
          <div className="px-10 py-12">
            {renderedHtml.trim().length === 0 ? (
              <div className="text-sm text-gray-400">
                Preview will appear here as you type…
              </div>
            ) : (
              <article
                className="doc"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="border-t px-3 py-2 text-xs text-gray-500">
        Phase 3: Markdown → HTML rendering.
      </div>
    </section>
  );
}
