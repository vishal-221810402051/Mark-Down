"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { DocStructuralGroup } from "@/lib/docIntelligence";

export type PreviewTheme = "whitepaper" | "dev" | "academic";

type Props = {
  title?: string;
  renderedHtml: string; // sanitized HTML
  theme: PreviewTheme;
  previewScrollRef?: RefObject<HTMLDivElement | null>;
  activeGroup?: DocStructuralGroup | null;
};

function isMermaidCodeBlock(codeEl: Element): boolean {
  const cls = codeEl.getAttribute("class") ?? "";
  const dataLang = codeEl.getAttribute("data-language") ?? "";
  const pre = codeEl.parentElement;
  const preLang = pre?.getAttribute("data-language") ?? "";
  return (
    cls.includes("language-mermaid") ||
    cls.includes("lang-mermaid") ||
    dataLang.toLowerCase() === "mermaid" ||
    preLang.toLowerCase() === "mermaid"
  );
}

function inferLangFromPre(pre: HTMLElement): string {
  const code = pre.querySelector("code");
  const codeDataLang = (code?.getAttribute("data-language") ?? "").trim();
  if (codeDataLang) return codeDataLang.toLowerCase();

  const preDataLang = (pre.getAttribute("data-language") ?? "").trim();
  if (preDataLang) return preDataLang.toLowerCase();

  const cls = code?.getAttribute("class") ?? "";
  const m = cls.match(/(?:language|lang)-([a-z0-9_-]+)/i);
  if (m?.[1]) return m[1].toLowerCase();
  return "text";
}

function displayLang(lang: string): string {
  const map: Record<string, string> = {
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    py: "Python",
    python: "Python",
    bash: "Bash",
    sh: "Shell",
    shell: "Shell",
    zsh: "zsh",
    powershell: "PowerShell",
    ps1: "PowerShell",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    html: "HTML",
    css: "CSS",
    text: "Text",
    mermaid: "Mermaid",
  };
  return map[lang] ?? lang.toUpperCase();
}

function getPreText(pre: HTMLElement): string {
  return pre.innerText ?? "";
}

function normalizeMermaid(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/^\s+|\s+$/g, "");
}

function assignPreviewAnchors(root: HTMLElement): void {
  const tables = Array.from(root.querySelectorAll("table"));
  tables.forEach((table, i) => {
    table.id = `table-${i + 1}`;
  });

  const procedures = Array.from(root.querySelectorAll(".procedure"));
  procedures.forEach((el, i) => {
    (el as HTMLElement).id = `procedure-${i + 1}`;
  });

  const callouts = Array.from(root.querySelectorAll(".callout"));
  callouts.forEach((el, i) => {
    (el as HTMLElement).id = `callout-${i + 1}`;
  });

  const codecards = Array.from(root.querySelectorAll(".codecard"));
  codecards.forEach((el, i) => {
    (el as HTMLElement).id = `codeblock-${i + 1}`;
  });

  const diagrams = Array.from(
    root.querySelectorAll(".mermaid-diagram, .ascii-diagram, .mermaid-error"),
  );
  diagrams.forEach((el, i) => {
    (el as HTMLElement).id = `diagram-${i + 1}`;
  });
}

export default function PreviewPane({
  title = "Preview",
  renderedHtml,
  theme,
  previewScrollRef,
  activeGroup,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const activeHighlightTimeoutRef = useRef<number | null>(null);
  const activeHighlightedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;
    let rafId = 0;

    const asciiBlocks = Array.from(root.querySelectorAll("p")).filter((p) =>
      /^[+|\- ]{5,}/.test((p.textContent ?? "").trim()),
    );

    asciiBlocks.forEach((p) => {
      const pre = document.createElement("pre");
      pre.className = "ascii-diagram";
      pre.textContent = p.textContent ?? "";
      p.replaceWith(pre);
    });

    const codeBlocks = root.querySelectorAll("pre");
    codeBlocks.forEach((pre) => {
      const language = inferLangFromPre(pre as HTMLElement);
      if (language === "ascii") {
        pre.classList.add("ascii-diagram");
        return;
      }

      const txt = pre.textContent ?? "";
      const looksAscii =
        /(\+[-=]{2,}\+)|(\|.{0,40}\|)|(-->)|(==>)|(\b[v^]\b)/.test(txt);
      if (looksAscii) pre.classList.add("ascii-diagram");
    });

    rafId = requestAnimationFrame(() => {
      if (cancelled) return;

      const mermaidBlocks = Array.from(root.querySelectorAll("pre > code")).filter(
        (code) => isMermaidCodeBlock(code),
      );

      if (mermaidBlocks.length > 0) {
        mermaidBlocks.forEach(async (codeEl) => {
          if (cancelled) return;
          const pre = codeEl.parentElement as HTMLElement | null;
          if (!pre) return;
          if (pre.getAttribute("data-mermaid-rendered") === "1") return;

          const code = normalizeMermaid(codeEl.textContent ?? "");
          pre.setAttribute("data-mermaid-rendered", "1");

          const placeholder = document.createElement("div");
          placeholder.className =
            "mermaid-pending my-3 rounded-lg border bg-white p-3 text-xs text-gray-500";
          placeholder.textContent = "Rendering diagram...";
          pre.replaceWith(placeholder);

          try {
            const res = await fetch("/api/mermaid", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(
                typeof data?.error === "string" ? data.error : "Mermaid render failed",
              );
            }

            const wrap = document.createElement("div");
            wrap.className =
              "mermaid-diagram my-4 overflow-auto rounded-lg border bg-white p-3";
            wrap.innerHTML = data.svg;
            placeholder.replaceWith(wrap);
            assignPreviewAnchors(root);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "unknown error";
            placeholder.className =
              "mermaid-error my-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700";
            placeholder.textContent = `Diagram render failed: ${message}`;
            assignPreviewAnchors(root);
          }
        });
      }
    });

    // Wrap code blocks as "codecards" with header + copy button
    const pres = Array.from(root.querySelectorAll("pre")) as HTMLElement[];

    pres.forEach((pre) => {
      if (pre.classList.contains("ascii-diagram")) return;
      if (pre.closest(".codecard")) return;

      const lang = inferLangFromPre(pre);
      if (lang === "ascii") return;
      const label = displayLang(lang);

      const wrapper = document.createElement("div");
      wrapper.className = "codecard";

      const bar = document.createElement("div");
      bar.className = "codecard-bar";

      const left = document.createElement("div");
      left.className = "codecard-lang";
      left.textContent = label;

      const btn = document.createElement("button");
      btn.className = "codecard-copy";
      btn.type = "button";
      btn.textContent = "Copy";

      btn.addEventListener("click", async () => {
        try {
          const text = getPreText(pre);
          await navigator.clipboard.writeText(text);
          btn.textContent = "Copied";
          setTimeout(() => (btn.textContent = "Copy"), 900);
        } catch {
          btn.textContent = "Failed";
          setTimeout(() => (btn.textContent = "Copy"), 900);
        }
      });

      bar.appendChild(left);
      bar.appendChild(btn);

      const parent = pre.parentElement;
      if (!parent) return;

      parent.insertBefore(wrapper, pre);
      wrapper.appendChild(bar);
      wrapper.appendChild(pre);
    });

    assignPreviewAnchors(root);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [renderedHtml]);

  useEffect(() => {
    if (!activeGroup) return;

    const container = previewScrollRef?.current;
    if (!container) return;

    if (activeHighlightTimeoutRef.current !== null) {
      window.clearTimeout(activeHighlightTimeoutRef.current);
      activeHighlightTimeoutRef.current = null;
    }

    if (activeHighlightedElementRef.current) {
      activeHighlightedElementRef.current.classList.remove("group-highlight");
      activeHighlightedElementRef.current = null;
    }

    let target: HTMLElement | null = null;

    if (activeGroup.parentId) {
      const candidate = container.querySelector(
        `#${CSS.escape(activeGroup.parentId)}`,
      );
      if (candidate instanceof HTMLElement) {
        target = candidate;
      }
    }

    if (!target && activeGroup.title) {
      const normalizedTitle = activeGroup.title.trim().toLowerCase();
      const elements = container.querySelectorAll("*");
      for (const el of elements) {
        const text = el.textContent?.trim().toLowerCase();
        if (!text) continue;
        if (text.includes(normalizedTitle)) {
          if (el instanceof HTMLElement) {
            target = el;
          }
          break;
        }
      }
    }

    if (!target) return;

    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetTop =
      targetRect.top - containerRect.top + container.scrollTop - 100;

    container.scrollTo({
      top: Math.max(0, offsetTop),
      behavior: "smooth",
    });

    target.classList.add("group-highlight");
    activeHighlightedElementRef.current = target;

    activeHighlightTimeoutRef.current = window.setTimeout(() => {
      if (activeHighlightedElementRef.current) {
        activeHighlightedElementRef.current.classList.remove("group-highlight");
        activeHighlightedElementRef.current = null;
      }
      activeHighlightTimeoutRef.current = null;
    }, 4000);
  }, [activeGroup, previewScrollRef]);

  useEffect(() => {
    return () => {
      if (activeHighlightTimeoutRef.current !== null) {
        window.clearTimeout(activeHighlightTimeoutRef.current);
        activeHighlightTimeoutRef.current = null;
      }
      if (activeHighlightedElementRef.current) {
        activeHighlightedElementRef.current.classList.remove("group-highlight");
        activeHighlightedElementRef.current = null;
      }
    };
  }, []);

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-gray-500">Print preview</div>
      </div>

      <div ref={previewScrollRef} className="flex-1 overflow-auto bg-gray-50 p-4">
        <div className="mx-auto w-full max-w-[820px] rounded-lg bg-white shadow-sm ring-1 ring-black/5">
          <div className="px-10 py-12">
            {renderedHtml.trim().length === 0 ? (
              <div className="text-sm text-gray-400">
                Preview will appear here as you type...
              </div>
            ) : (
              <div ref={ref}>
                <article
                  className={`doc theme-${theme}`}
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
