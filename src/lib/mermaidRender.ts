import { chromium } from "playwright";

export async function renderMermaidToSvg(code: string): Promise<string> {
  const cleaned = (code ?? "").trim();
  if (!cleaned) throw new Error("Empty mermaid code");
  if (cleaned.length > 50_000) throw new Error("Mermaid code too large");

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
      <pre class="mermaid">${escapeHtml(cleaned)}</pre>
    </div>

    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
      mermaid.initialize({
        startOnLoad: true,
        theme: "default",
        securityLevel: "strict",
        flowchart: {
          htmlLabels: false,
          nodeSpacing: 50,
          rankSpacing: 50,
          padding: 10
        }
      });
    </script>
  </body>
</html>
`;

    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForSelector("svg", { timeout: 10_000 });

    return await page.$eval("svg", (el) => (el as SVGElement).outerHTML);
  } finally {
    await browser.close();
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
