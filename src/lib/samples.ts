export const SAMPLES: Record<string, string> = {
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
