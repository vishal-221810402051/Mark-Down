import { NextResponse } from "next/server";
import { chromium } from "playwright";

export const runtime = "nodejs";

type ReqBody = { code?: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const code = (body.code ?? "").trim();

  if (!code) {
    return NextResponse.json({ error: "Missing mermaid code" }, { status: 400 });
  }

  if (code.length > 50_000) {
    return NextResponse.json({ error: "Mermaid code too large" }, { status: 413 });
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; padding: 16px; font-family: Arial, sans-serif; }
      #container { display: inline-block; }
    </style>
  </head>
  <body>
    <div id="container">
      <pre class="mermaid">${escapeHtml(code)}</pre>
    </div>

    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
      mermaid.initialize({
        startOnLoad: true,
        theme: "default",
        securityLevel: "strict"
      });
    </script>
  </body>
</html>
`;

    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForSelector("svg", { timeout: 10_000 });

    const svg = await page.$eval("svg", (el) => (el as SVGElement).outerHTML);

    return NextResponse.json({ svg });
  } finally {
    await browser.close();
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
