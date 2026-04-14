import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "txt") as "txt" | "md" | "pdf" | "docx";

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const title = meeting.title || "Untitled Meeting";
  const date = new Date(meeting.created_at).toLocaleString();
  const transcript = meeting.transcript || "";
  const summary = meeting.summary || "";

  if (format === "md") {
    const content = `# ${title}\n\n**Date:** ${date}\n\n## Summary\n\n${summary}\n\n## Transcript\n\n${transcript}\n`;
    return new Response(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName(title)}.md"`,
      },
    });
  }

  if (format === "txt") {
    const content = `${title}\n${"=".repeat(title.length)}\n\nDate: ${date}\n\n--- SUMMARY ---\n\n${summary}\n\n--- TRANSCRIPT ---\n\n${transcript}\n`;
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName(title)}.txt"`,
      },
    });
  }

  if (format === "pdf") {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;}h1{border-bottom:2px solid #333;padding-bottom:8px;}h2{color:#555;margin-top:24px;}pre{white-space:pre-wrap;font-family:inherit;}</style></head><body><h1>${escapeHtml(title)}</h1><p><strong>Date:</strong> ${escapeHtml(date)}</p><h2>Summary</h2><pre>${escapeHtml(summary)}</pre><h2>Transcript</h2><pre>${escapeHtml(transcript)}</pre></body></html>`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName(title)}.html"`,
      },
    });
  }

  if (format === "docx") {
    const rtf = `{\\rtf1\\ansi\\deff0\n\\b\\fs32 ${escapeRtf(title)}\\b0\\fs24\\par\nDate: ${escapeRtf(date)}\\par\\par\n\\b Summary\\b0\\par ${escapeRtf(summary)}\\par\\par\n\\b Transcript\\b0\\par ${escapeRtf(transcript)}\\par\n}`;
    return new Response(rtf, {
      headers: {
        "Content-Type": "application/rtf",
        "Content-Disposition": `attachment; filename="${safeName(title)}.rtf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, "_").slice(0, 60);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRtf(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\n/g, "\\par ");
}
