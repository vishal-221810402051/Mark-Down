"use client";

import { useState } from "react";
import type { ReactNode, RefObject } from "react";

import type { DocDiagnostics } from "@/lib/docDiagnostics";
import type { DocIntelligence, DocStructuralGroup } from "@/lib/docIntelligence";

type Props = {
  intelligence: DocIntelligence | null;
  diagnostics?: DocDiagnostics | null;
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
  diagnostics,
  previewScrollRef,
  activeHeadingId,
}: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const sections = intelligence?.headings ?? [];
  const groups = intelligence?.groups ?? [];
  const hierarchy = intelligence?.hierarchy ?? [];
  const title =
    intelligence?.titleBlock?.title ??
    sections.find((h) => h.level === 1)?.text ??
    sections[0]?.text ??
    null;
  const codeBlocks = intelligence?.codeBlocks ?? [];
  const tables = intelligence?.tables ?? [];
  const diagrams = intelligence?.diagrams ?? [];
  const procedures = intelligence?.procedures ?? [];
  const roadmaps = intelligence?.roadmaps ?? [];
  const commandBlocks = codeBlocks.filter((b) => b.kind === "command");

  const groupsByParentId = new Map<string, DocStructuralGroup[]>();
  const headingIds = new Set(sections.map((h) => h.id));
  const titleNodeIds = new Set(
    hierarchy.filter((n) => n.role === "title").map((n) => n.id),
  );

  for (const group of groups) {
    const parentKey = group.parentId ?? "root";
    const arr = groupsByParentId.get(parentKey) ?? [];
    arr.push(group);
    groupsByParentId.set(parentKey, arr);
  }

  for (const arr of groupsByParentId.values()) {
    arr.sort((a, b) => (a.startLine ?? Number.MAX_SAFE_INTEGER) - (b.startLine ?? Number.MAX_SAFE_INTEGER));
  }

  const rootGroups = groups.filter(
    (g) => !g.parentId || g.parentId === "root" || titleNodeIds.has(g.parentId),
  );
  const otherGroups = groups.filter(
    (g) => g.parentId && !headingIds.has(g.parentId) && !titleNodeIds.has(g.parentId),
  );

  const groupKindMeta: Record<
    DocStructuralGroup["kind"],
    { icon: string; label: string }
  > = {
    procedure_block: { icon: "⚙", label: "Procedure" },
    entity_group: { icon: "🧩", label: "Entities" },
    phase_block: { icon: "📍", label: "Phase" },
    list_section: { icon: "•", label: "List" },
    prose_section: { icon: "•", label: "Prose" },
    table_section: { icon: "•", label: "Table" },
  };

  const formatGroupLabel = (group: DocStructuralGroup) => {
    const meta = groupKindMeta[group.kind];
    const titleLabel = group.title?.trim() || "Untitled";
    return `${meta.label} — ${titleLabel}`;
  };

  const renderGroupRow = (
    group: DocStructuralGroup,
    parentHeadingId?: string,
  ) => (
    <button
      key={group.id}
      type="button"
      style={{
        paddingLeft: "24px",
        opacity: 0.85,
        fontSize: "13px",
        color: "rgba(255,255,255,0.7)",
      }}
      className="mb-1 block w-full rounded-lg py-1 text-left hover:bg-white/5"
      onClick={() => {
        if (parentHeadingId) {
          scrollToTarget(previewScrollRef, parentHeadingId);
        }
      }}
    >
      {groupKindMeta[group.kind].icon} {formatGroupLabel(group)}
    </button>
  );

  return (
    <aside className="h-full overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-2xl shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
      <div className="mb-3">
        <div className="text-sm font-bold text-white/95">Document Map</div>
        {title ? <div className="text-xs text-white/70">{title}</div> : null}
        {intelligence ? (
          <div className="mt-1 text-xs leading-5 text-white/55">
            {intelligence.stats.headings} headings · {intelligence.stats.commandBlocks} commands
            · {intelligence.stats.tables} tables · {intelligence.stats.diagrams} diagrams ·{" "}
            {intelligence.stats.procedures} procedures
          </div>
        ) : null}      </div>

      {diagnostics && diagnostics.items.length > 0 ? (
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Diagnostics
          </div>
          <div className="mt-1 text-xs text-white/55">
            {diagnostics.summary.error} errors · {diagnostics.summary.warning} warnings ·{" "}
            {diagnostics.summary.info} info
          </div>
          {diagnostics?.documentType && (
            <div className="mt-2 text-xs text-white/50">
              Document type: {diagnostics.documentType}
            </div>
          )}
          {diagnostics?.hierarchyGrade && (
            <div className="text-xs text-white/50">
              Heading structure: {diagnostics.hierarchyGrade}
            </div>
          )}
          <div className="mt-3 space-y-2">
            {diagnostics.items.slice(0, 5).map((item, i) => (
              <div
                key={`${item.kind}-${i}`}
                className="rounded-xl border border-white/8 bg-black/20 px-3 py-2"
              >
                <div className="text-xs font-medium text-white/85">{item.message}</div>
                {item.detail ? (
                  <div className="mt-0.5 text-[11px] leading-4 text-white/45">{item.detail}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <Group title="Document-level groups" count={rootGroups.length} defaultOpen={false}>
          {rootGroups.map((group) => renderGroupRow(group))}
        </Group>

        <Group title="Sections" count={sections.length}>
          {sections.map((h) => {
            const childGroups = groupsByParentId.get(h.id) ?? [];
            const groupCount = childGroups.length;
            const collapsed = collapsedSections[h.id] ?? false;

            return (
            <div key={h.id}>
              <Item
                label={h.text}
                sublabel={`H${h.level}${groupCount > 0 ? ` · ${groupCount} groups` : ""}`}
                active={activeHeadingId === h.id}
                onClick={() => scrollToTarget(previewScrollRef, h.id)}
              />
              {groupCount > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedSections((prev) => ({
                      ...prev,
                      [h.id]: !collapsed,
                    }))
                  }
                  className="mb-1 ml-3 rounded-lg px-2 py-1 text-xs text-white/60 hover:bg-white/8 hover:text-white/80"
                >
                  {collapsed ? "Show groups" : "Hide groups"}
                </button>
              ) : null}
              {!collapsed ? childGroups.map((group) => renderGroupRow(group, h.id)) : null}
            </div>
          );
          })}
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

        <Group title="Other groups" count={otherGroups.length} defaultOpen={false}>
          {otherGroups.map((group) => renderGroupRow(group))}
        </Group>
      </div>
    </aside>
  );
}
