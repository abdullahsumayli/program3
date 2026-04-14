import OpenAI from "openai";

// Lazy-instantiate so module import at build time doesn't require the env var.
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://meetings.local",
        "X-Title": "Meeting Assistant",
      },
    });
  }
  return _client;
}

const MODEL = "anthropic/claude-sonnet-4.5";

// Rough token estimate: 1 token ≈ 3 chars for mixed content
const MAX_INPUT_CHARS = 500_000;

export async function summarizeTranscript(
  transcript: string,
  systemPrompt: string
): Promise<string> {
  if (!transcript.trim()) return "";

  if (transcript.length <= MAX_INPUT_CHARS) {
    return singleSummarize(transcript, systemPrompt);
  }

  // Hierarchical: split into chunks, summarize each, then summarize summaries
  const chunks = chunkText(transcript, MAX_INPUT_CHARS);
  const partialSummaries: string[] = [];
  for (const chunk of chunks) {
    const summary = await singleSummarize(chunk, systemPrompt);
    partialSummaries.push(summary);
  }
  return singleSummarize(partialSummaries.join("\n\n---\n\n"), systemPrompt);
}

export async function generateTitle(summary: string): Promise<string> {
  if (!summary.trim()) return "";
  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 60,
    messages: [
      {
        role: "system",
        content:
          "Generate a short concise title (max 8 words) for a meeting based on its summary. Output ONLY the title, no quotes, no punctuation at the end. Use the same language as the input.",
      },
      { role: "user", content: summary.slice(0, 2000) },
    ],
  });
  return completion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") ?? "";
}

async function singleSummarize(text: string, systemPrompt: string): Promise<string> {
  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here is the meeting transcript:\n\n${text}` },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      // Back off to the nearest sentence boundary
      const lastPeriod = text.lastIndexOf(".", end);
      if (lastPeriod > i + size / 2) end = lastPeriod + 1;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}
