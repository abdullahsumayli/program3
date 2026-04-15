import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://meetings.local",
        "X-Title": "Meeting OS",
      },
    });
  }

  return client;
}

const MODEL = "anthropic/claude-sonnet-4.5";
const MAX_INPUT_CHARS = 500_000;

export type MeetingArtifacts = {
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  tasks: Array<{
    description: string;
    owner: string | null;
    dueDate: string | null;
  }>;
};

const BASE_SYSTEM_PROMPT = `
You are an enterprise meeting operations assistant.
Analyze the transcript and return valid JSON only.

Required JSON shape:
{
  "title": "short meeting title",
  "summary": "clear structured summary in markdown",
  "keyPoints": ["point 1", "point 2"],
  "decisions": ["decision 1", "decision 2"],
  "tasks": [
    {
      "description": "clear actionable task",
      "owner": "person name or null",
      "dueDate": "YYYY-MM-DD or null"
    }
  ]
}

Rules:
- Use the same language as the transcript.
- Summary must be organized and concise.
- Extract only decisions that are actually supported by the transcript.
- Extract only execution tasks. Each task must be specific and actionable.
- If owner or due date is not mentioned, return null.
- keyPoints, decisions, and tasks must be arrays.
- Do not include any text outside the JSON object.
`.trim();

export async function generateMeetingArtifacts(
  transcript: string,
  customInstructions?: string
): Promise<MeetingArtifacts> {
  if (!transcript.trim()) {
    return { title: "", summary: "", keyPoints: [], decisions: [], tasks: [] };
  }

  const summarizedTranscript =
    transcript.length <= MAX_INPUT_CHARS
      ? transcript
      : await compressTranscript(transcript, customInstructions);

  const prompt = customInstructions?.trim()
    ? `${BASE_SYSTEM_PROMPT}\n\nAdditional instructions:\n${customInstructions.trim()}`
    : BASE_SYSTEM_PROMPT;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Meeting transcript:\n\n${summarizedTranscript}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = parseJsonObject(raw);

  return {
    title: asString(parsed.title),
    summary: asString(parsed.summary),
    keyPoints: asStringArray(parsed.keyPoints),
    decisions: asStringArray(parsed.decisions),
    tasks: asTaskArray(parsed.tasks),
  };
}

async function compressTranscript(transcript: string, customInstructions?: string) {
  const chunks = chunkText(transcript, MAX_INPUT_CHARS);
  const partials: string[] = [];

  for (const chunk of chunks) {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content: [
            "Summarize this portion of a company meeting transcript.",
            "Keep concrete facts, owners, dates, decisions, and action items.",
            customInstructions?.trim() ? `Additional instructions:\n${customInstructions.trim()}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        { role: "user", content: chunk },
      ],
    });

    partials.push(completion.choices[0]?.message?.content ?? "");
  }

  return partials.join("\n\n");
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    let end = Math.min(index + size, text.length);
    if (end < text.length) {
      const lastBreak = Math.max(text.lastIndexOf(".", end), text.lastIndexOf("\n", end));
      if (lastBreak > index + size / 2) end = lastBreak + 1;
    }

    chunks.push(text.slice(index, end));
    index = end;
  }

  return chunks;
}

function parseJsonObject(raw: string) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : cleaned;
  return JSON.parse(jsonText) as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function asTaskArray(value: unknown): MeetingArtifacts["tasks"] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const description = asString(record.description);
      if (!description) return null;

      const owner = asString(record.owner) || null;
      const dueDate = normalizeDate(asString(record.dueDate));

      return { description, owner, dueDate };
    })
    .filter((task): task is NonNullable<typeof task> => Boolean(task));
}

function normalizeDate(value: string) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
