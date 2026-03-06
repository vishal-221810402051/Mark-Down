"use client";

import { useMemo, useState } from "react";
import type { ReactNode, RefObject } from "react";

import type { DocIntelligence } from "@/lib/docIntelligence";

type Props = {
  intelligence: DocIntelligence | null;
  previewScrollRef: RefObject<HTMLDivElement | null>;
  activeHeadingId?: string | null;
};

type GroupProps = {
  title: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
};

function Group({ title, count, children, defaultOpen = true }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="text-xs text-white/60">
          {count} {open ? "-" : "+"}
        </div>
      </button>
      {open ? <div className="border-t border-white/10 px-2 py-2">{children}</div> : null}
    </div>
  );
}

function Item({
  label,
  sublabel,
  active = false,
  onClick,
}: {
  label: string;
  sublabel?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-1 w-full rounded-xl px-3 py-2 text-left transition ${
        active
          ? "bg-white/14 text-white"
          : "bg-transparent text-white/80 hover:bg-white/8 hover:text-white"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      {sublabel ? <div className="mt-0.5 text-xs text-white/50">{sublabel}</div> : null}
    </button>
  );
}

function scrollToTarget(
  previewScrollRef: RefObject<HTMLDivElement | null>,
  targetId: string,
) {
  const scroller = previewScrollRef.current;
  if (!scroller) return;
  const target = scroller.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`);
  if (!target) return;

  const top = target.offsetTop - 16;
  scroller.scrollTo({ top, behavior: "smooth" });
}

export default function DocumentMap({
  intelligence,
  previewScrollRef,
  activeHeadingId,
}: Props) {
  const sections = intelligence?.headings ?? [];
  const codeBlocks = intelligence?.codeBlocks;
  const tables = intelligence?.tables ?? [];
  const diagrams = intelligence?.diagrams ?? [];
  const procedures = intelligence?.procedures ?? [];
  const roadmaps = intelligence?.roadmaps ?? [];
  const commandBlocks = useMemo(
    () => (codeBlocks ?? []).filter((b) => b.kind === "command"),
    [codeBlocks],
  );

  return (
    <aside className="h-full overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-2xl shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
      <div className="mb-3">
        <div className="text-sm font-bold text-white/95">Document Map</div>
        {intelligence?.summary?.short ? (
          <div className="mt-1 text-xs leading-5 text-white/55">{intelligence.summary.short}</div>
        ) : null}
      </div>

      <div className="space-y-3">
        <Group title="Sections" count={sections.length}>
          {sections.map((h) => (
            <Item
              key={h.id}
              label={h.text}
              sublabel={`H${h.level}`}
              active={activeHeadingId === h.id}
              onClick={() => scrollToTarget(previewScrollRef, h.id)}
            />
          ))}
        </Group>

        <Group title="Commands" count={commandBlocks.length} defaultOpen={false}>
          {commandBlocks.map((b, i) => (
            <Item
              key={`cmd-${i}`}
              label={b.preview}
              sublabel={b.language}
              onClick={() => scrollToTarget(previewScrollRef, `codeblock-${i + 1}`)}
            />
          ))}
        </Group>

        <Group title="Tables" count={tables.length} defaultOpen={false}>
          {tables.map((t) => (
            <Item
              key={`table-${t.index}`}
              label={t.title || `Table ${t.index}`}
              sublabel={`${t.rows} rows - ${t.cols} cols`}
              onClick={() => scrollToTarget(previewScrollRef, `table-${t.index}`)}
            />
          ))}
        </Group>

        <Group title="Diagrams" count={diagrams.length} defaultOpen={false}>
          {diagrams.map((d) => (
            <Item
              key={`diagram-${d.index}`}
              label={d.title || `${d.kind === "mermaid" ? "Mermaid" : "ASCII"} ${d.index}`}
              sublabel={d.preview}
              onClick={() => scrollToTarget(previewScrollRef, `diagram-${d.index}`)}
            />
          ))}
        </Group>

        <Group title="Procedures" count={procedures.length} defaultOpen={false}>
          {procedures.map((p, i) => (
            <Item
              key={`procedure-${i + 1}`}
              label={p.title}
              sublabel={`${p.kind} - ${p.itemCount} items`}
              onClick={() => scrollToTarget(previewScrollRef, `procedure-${i + 1}`)}
            />
          ))}
        </Group>

        <Group title="Roadmaps" count={roadmaps.length} defaultOpen={false}>
          {roadmaps.map((r, i) => (
            <Item
              key={`roadmap-${i}`}
              label={r.title}
              sublabel={r.kind}
              onClick={() => {
                const match = sections.find((s) => s.text === r.title);
                if (match) scrollToTarget(previewScrollRef, match.id);
              }}
            />
          ))}
        </Group>
      </div>
    </aside>
  );
}
