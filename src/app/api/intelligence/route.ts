import { NextResponse } from "next/server";

import { extractDocDiagnostics } from "@/lib/docDiagnostics";
import { normalizeInput } from "@/lib/normalize";
import { parseMarkdownToHtml } from "@/lib/parse";

export const runtime = "nodejs";

type IntelligenceReq = {
  text?: unknown;
  inferSemanticHeadings?: unknown;
};

const MAX_INPUT_CHARS = 500_000;

function toBoolean(value: unknown): boolean {
  return value === true;
}

function deriveDocTitle(params: {
  normalizedText: string;
  intelligenceTitle: string | null;
  titleBlockTitle?: string | null;
  firstHeadingText?: string | null;
}): string {
  const { normalizedText, intelligenceTitle, titleBlockTitle, firstHeadingText } = params;
  const candidate =
    titleBlockTitle?.trim() ||
    intelligenceTitle?.trim() ||
    firstHeadingText?.trim() ||
    normalizedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.replace(/^#+\s*/, "")
      .trim();

  return candidate || "Mark-Down Document";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as IntelligenceReq;
  const text = body.text;
  const inferSemanticHeadings = toBoolean(body.inferSemanticHeadings);

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Invalid request: 'text' must be a non-empty string." },
      { status: 400 },
    );
  }

  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Input too large. Maximum supported size is ${MAX_INPUT_CHARS} characters.` },
      { status: 413 },
    );
  }

  try {
    const { normalizedText, notes, stats } = normalizeInput(text, {
      inferSemanticHeadings,
    });

    const parsed = await parseMarkdownToHtml(normalizedText, {
      includeToc: false,
    });

    let diagnostics = null;
    try {
      diagnostics = extractDocDiagnostics({
        rawText: text,
        normalizedText,
        notes,
        stats,
        renderedHtml: parsed.html,
        headings: parsed.headings,
        intelligence: parsed.intelligence,
      });
    } catch {
      diagnostics = null;
    }

    const docTitle = deriveDocTitle({
      normalizedText,
      intelligenceTitle: parsed.intelligence.title,
      titleBlockTitle: parsed.intelligence.titleBlock?.title,
      firstHeadingText: parsed.headings[0]?.text ?? null,
    });

    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        app: "Mark-Down",
        version: "0.1.0",
        schemaVersion: "a1",
      },
      input: {
        rawText: text,
        normalizedText,
        docTitle,
        inferSemanticHeadings,
      },
      normalization: {
        notes,
        stats,
      },
      intelligence: parsed.intelligence ?? null,
      diagnostics,
      parse: {
        parseError: null as string | null,
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to process document intelligence." },
      { status: 500 },
    );
  }
}

