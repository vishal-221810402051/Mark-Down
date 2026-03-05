"use client";

import { useEffect, useRef } from "react";

export type PreviewTheme = "whitepaper" | "dev" | "academic";

type Props = {
  title?: string;
  renderedHtml: string; // sanitized HTML
  theme: PreviewTheme;
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

export default function PreviewPane({
  title = "Preview",
  renderedHtml,
  theme,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const codeBlocks = root.querySelectorAll("pre");
    codeBlocks.forEach((pre) => {
      const txt = pre.textContent ?? "";
      const looksAscii =
        /(\+[-=]{2,}\+)|(\|.{0,40}\|)|(-->)|(==>)|(\b[v^]\b)/.test(txt);
      if (looksAscii) pre.classList.add("ascii-diagram");
    });

    const mermaidBlocks = Array.from(root.querySelectorAll("pre > code")).filter(
      (code) => isMermaidCodeBlock(code),
    );

    if (mermaidBlocks.length > 0) {
      mermaidBlocks.forEach(async (codeEl) => {
        const pre = codeEl.parentElement as HTMLElement | null;
        if (!pre) return;
        if (pre.getAttribute("data-mermaid-rendered") === "1") return;

        const code = codeEl.textContent ?? "";
        pre.setAttribute("data-mermaid-rendered", "1");

        const placeholder = document.createElement("div");
        placeholder.className =
          "my-3 rounded-lg border bg-white p-3 text-xs text-gray-500";
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
          wrap.className = "my-4 overflow-auto rounded-lg border bg-white p-3";
          wrap.innerHTML = data.svg;
          placeholder.replaceWith(wrap);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "unknown error";
          placeholder.textContent = `Diagram render failed: ${message}`;
        }
      });
    }

    // Wrap code blocks as "codecards" with header + copy button
    const pres = Array.from(root.querySelectorAll("pre")) as HTMLElement[];

    pres.forEach((pre) => {
      if (pre.closest(".codecard")) return;

      const lang = inferLangFromPre(pre);
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
  }, [renderedHtml]);

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

      <div className="border-t px-3 py-2 text-xs text-gray-500">
        Phase 8: Mermaid SVG rendering + ASCII diagram handling.
      </div>
    </section>
  );
}
