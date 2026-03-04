import { NextResponse } from "next/server";
import { renderMermaidToSvg } from "@/lib/mermaidRender";

export const runtime = "nodejs";

type ReqBody = { code?: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const code = (body.code ?? "").trim();

  if (!code) {
    return NextResponse.json({ error: "Missing mermaid code" }, { status: 400 });
  }

  try {
    const svg = await renderMermaidToSvg(code);
    return NextResponse.json({ svg });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Mermaid render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
