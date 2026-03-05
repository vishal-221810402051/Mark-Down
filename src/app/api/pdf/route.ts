import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { chromium } from "playwright";

import { normalizeInput } from "@/lib/normalize";
import { parseMarkdownToHtml } from "@/lib/parse";
import { renderMermaidToSvg } from "@/lib/mermaidRender";

export const runtime = "nodejs";

type PdfReq = {
  markdown?: string;
  title?: string;
  theme?: "whitepaper" | "dev" | "academic";
  includeToc?: boolean;
  tocDepth?: 2 | 3 | 4;
  marginPreset?: "compact" | "normal" | "spacious";
  tablePreset?: "equal" | "wide-first" | "wide-middle";
};

function marginsForPreset(p: "compact" | "normal" | "spacious") {
  if (p === "compact") {
    return { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" };
  }
  if (p === "spacious") {
    return { top: "28mm", right: "22mm", bottom: "28mm", left: "22mm" };
  }
  return { top: "24mm", right: "18mm", bottom: "24mm", left: "18mm" };
}

function getDocCss(): string {
  const cssPath = path.join(process.cwd(), "src", "app", "doc.css");
  return fs.readFileSync(cssPath, "utf8");
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeHtml(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function codeHtmlToPlainText(codeHtml: string): string {
  return decodeHtml(
    codeHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/span>\s*<span[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

async function inlineMermaidSvgs(html: string): Promise<string> {
  const mermaidRe =
    /<pre[^>]*>\s*<code[^>]*(?:class="[^"]*(?:language-mermaid|lang-mermaid)[^"]*"|data-language="mermaid")[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g;

  const matches: Array<{ full: string; codeHtml: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = mermaidRe.exec(html)) !== null) {
    matches.push({ full: m[0], codeHtml: m[1] ?? "" });
  }

  if (matches.length === 0) return html;

  let out = html;
  for (const item of matches) {
    const codeText = codeHtmlToPlainText(item.codeHtml);
    const svg = await renderMermaidToSvg(codeText);
    const wrapped = `<div class="mermaid-svg">${svg}</div>`;
    out = out.replace(item.full, wrapped);
  }

  return out;
}

function buildFullHtml(opts: {
  title: string;
  theme: "whitepaper" | "dev" | "academic";
  tablePreset: "equal" | "wide-first" | "wide-middle";
  bodyHtml: string;
  margins: { top: string; right: string; bottom: string; left: string };
}): string {
  const docCss = getDocCss();
  const printCss = `
@page { size: A4; margin: ${opts.margins.top} ${opts.margins.right} ${opts.margins.bottom} ${opts.margins.left}; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.mermaid-svg {
  margin: 1rem 0;
  padding: 0.75rem;
  border: 1px solid rgba(0,0,0,0.10);
  border-radius: 12px;
  background: #fff;
  overflow: auto;
}
.mermaid-svg svg { max-width: 100%; height: auto; }
`;

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(opts.title)}</title>
    <style>${docCss}</style>
    <style>${printCss}</style>
  </head>
  <body>
    <main class="doc theme-${opts.theme} table-${opts.tablePreset}">
      ${opts.bodyHtml}
    </main>
  </body>
</html>
`;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PdfReq;

  const markdownRaw = (body.markdown ?? "").toString();
  if (!markdownRaw.trim()) {
    return NextResponse.json({ error: "Missing markdown" }, { status: 400 });
  }

  const theme: "whitepaper" | "dev" | "academic" = body.theme ?? "whitepaper";
  const includeToc = body.includeToc ?? true;
  const tocDepth = (body.tocDepth ?? 3) as 2 | 3 | 4;
  const marginPreset = body.marginPreset ?? "normal";
  const tablePreset = body.tablePreset ?? "equal";
  const margins = marginsForPreset(marginPreset);
  const title = (body.title ?? "Mark-Down Document").toString();

  try {
    const norm = normalizeInput(markdownRaw);

    const parsed = await parseMarkdownToHtml(norm.normalizedText, {
      includeToc,
      tocMaxDepth: tocDepth,
    });

    const htmlWithDiagrams = await inlineMermaidSvgs(parsed.html);
    const fullHtml = buildFullHtml({
      title,
      theme,
      tablePreset,
      bodyHtml: htmlWithDiagrams,
      margins,
    });

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: "networkidle" });

      const footerTemplate = `
<div style="width:100%; font-size:9px; color:#6b7280; padding:0 ${margins.right};">
  <div style="width:100%; display:flex; justify-content:space-between;">
    <span>${escapeHtml(title)}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>
</div>`;

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate,
        margin: margins,
      });

      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(
            title.replace(/\s+/g, "_"),
          )}.pdf"`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
