import { NextResponse } from "next/server";

import { extractDocDiagnostics, type DocDiagnostics } from "@/lib/docDiagnostics";
import type { DocIntelligence } from "@/lib/docIntelligence";
import { normalizeInput } from "@/lib/normalize";
import { parseMarkdownToHtml } from "@/lib/parse";
import {
  resolveExternalDocTitle,
  SCHEMA_VERSION,
  toExternalDiagnostics,
  toExternalIntelligence,
} from "@/lib/payloadContract";
import type { DocHeading } from "@/lib/docModel";

export const runtime = "nodejs";

type IntelligenceReq = {
  text?: unknown;
  inferSemanticHeadings?: unknown;
};

const MAX_INPUT_CHARS = 500_000;

function toBoolean(value: unknown): boolean {
  return value === true;
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

    let renderedHtml = "";
    let parsedHeadings: DocHeading[] = [];
    let parsedIntelligence: DocIntelligence | null = null;
    let parseError: string | null = null;

    try {
      const parsed = await parseMarkdownToHtml(normalizedText, {
        includeToc: false,
      });
      renderedHtml = parsed.html;
      parsedHeadings = parsed.headings;
      parsedIntelligence = parsed.intelligence ?? null;
    } catch (e: unknown) {
      parseError = e instanceof Error ? e.message : "Parse error";
    }

    let diagnosticsInternal: DocDiagnostics | null = null;
    try {
      diagnosticsInternal = extractDocDiagnostics({
        rawText: text,
        normalizedText,
        notes,
        stats,
        renderedHtml,
        headings: parsedHeadings,
        intelligence: parsedIntelligence,
      });
    } catch {
      diagnosticsInternal = null;
    }

    const externalIntelligence = toExternalIntelligence(parsedIntelligence);
    const diagnostics = toExternalDiagnostics(diagnosticsInternal);
    const docTitle = resolveExternalDocTitle(externalIntelligence);

    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        app: "Mark-Down",
        version: "0.1.0",
        schemaVersion: SCHEMA_VERSION,
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
      intelligence: externalIntelligence,
      diagnostics,
      parse: {
        parseError,
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
