# Mark-Down

Mark-Down is a Next.js application that converts messy ChatGPT-style notes into clean, printable PDF documents.

## Current Capabilities
- Monaco editor for raw input
- Smart normalization pipeline (headings, lists, fence repair, code auto-fencing, wrapped table conversion)
- Markdown -> HTML preview with TOC support
- Mermaid diagram rendering
- PDF export (A4, page numbers, theme/margin controls)
- Suggestions-only Layout Optimizer (diff-first, apply/revert)

## Tech Stack
- Next.js (App Router, TypeScript)
- Tailwind CSS
- Remark/Rehype pipeline
- Shiki code highlighting
- Playwright for Mermaid/PDF rendering

## Run Locally
```powershell
npm install
npm run dev
```

Open: `http://localhost:3000`

Optional port helper:
```powershell
npm run dev:3002
```

## Run with Docker
```powershell
docker compose up --build
```

Open: `http://localhost:3001`

Stop:
```powershell
docker compose down
```

## Quality Checks
```powershell
npm run lint
npm run build
```

## Notes
- PDF output is generated server-side via `/api/pdf`.
- Mermaid diagrams are rendered before PDF generation.
- Optimizer suggestions are approval-only and reversible.

## License
This project is proprietary and licensed under **All Rights Reserved**.
See [LICENSE](./LICENSE).