"use client";

import { useMemo, useState } from "react";
import EditorPane from "@/components/EditorPane";
import PreviewPane from "@/components/PreviewPane";
import TopBar from "@/components/TopBar";

const SAMPLES: Record<string, string> = {
  basic: `# Title
## Section
This is a paragraph.

- Bullet 1
- Bullet 2

\`\`\`python
def hello():
    print("Hello")
\`\`\`
`,
  chatgpt: `Title:
My Doc

Section: Installation
pip install fastapi
uvicorn app:main --reload

Notes:
• this bullet uses a dot
1) this numbering uses a bracket

Flow:
A -> B -> C
`,
  tables: `# Data Summary

Name    Age    City
John    21     Paris
Anna    30     Berlin

- Alpha
- Beta
  - Nested 1
  - Nested 2
`,
  mermaid: `# Architecture

\`\`\`mermaid
graph TD
  A[User] --> B[Web App]
  B --> C[Parser]
  C --> D[HTML Renderer]
  D --> E[PDF Engine]
\`\`\`
`,
};

export default function HomePage() {
  const [rawText, setRawText] = useState<string>("");

  const previewText = useMemo(() => rawText, [rawText]);

  return (
    <div className="min-h-screen bg-white">
      <TopBar />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-2">
        <div className="h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border">
          <EditorPane
            value={rawText}
            onChange={setRawText}
            onLoadSample={(id) => setRawText(SAMPLES[id] ?? "")}
          />
        </div>

        <div className="h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border">
          <PreviewPane raw={previewText} />
        </div>
      </main>
    </div>
  );
}
