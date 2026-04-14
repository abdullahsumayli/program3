"use client";

import { useEffect, useRef } from "react";
import type { Token } from "@soniox/speech-to-text-web";

export function LiveTranscript({
  finalTokens,
  nonFinalTokens,
}: {
  finalTokens: Token[];
  nonFinalTokens: Token[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [finalTokens, nonFinalTokens]);

  // Group tokens by speaker for display
  const grouped = groupBySpeaker([...finalTokens, ...nonFinalTokens]);

  return (
    <div
      ref={scrollRef}
      className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-900"
    >
      {grouped.length === 0 ? (
        <div className="text-sm text-gray-400">...</div>
      ) : (
        <div className="space-y-2">
          {grouped.map((g, i) => (
            <div key={i} className="flex gap-2">
              {g.speaker && (
                <span className="flex-shrink-0 text-xs font-semibold text-blue-600">
                  Speaker {g.speaker}:
                </span>
              )}
              <span className={g.isFinal ? "" : "text-gray-400"}>{g.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupBySpeaker(tokens: Token[]) {
  const groups: { speaker: string | undefined; text: string; isFinal: boolean }[] = [];
  for (const t of tokens) {
    const text = t.text.replace(/<end>/gi, "");
    if (!text) continue;
    const last = groups[groups.length - 1];
    if (last && last.speaker === t.speaker && last.isFinal === t.is_final) {
      last.text += text;
    } else {
      groups.push({ speaker: t.speaker, text, isFinal: t.is_final });
    }
  }
  return groups;
}
