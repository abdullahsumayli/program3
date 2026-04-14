"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";

export function MicTest() {
  const { t } = useLanguage();
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<"idle" | "ok" | "error">("idle");
  const cleanupRef = useRef<(() => void) | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult("idle");
    setLevel(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      let maxLevel = 0;
      let closed = false;
      const startTime = Date.now();
      const cleanup = () => {
        if (closed) return;
        closed = true;
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
      };
      const tick = () => {
        if (Date.now() - startTime > 3000) {
          cleanup();
          setTesting(false);
          setResult(maxLevel > 10 ? "ok" : "error");
          setLevel(0);
          return;
        }
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        maxLevel = Math.max(maxLevel, avg);
        setLevel(avg);
        requestAnimationFrame(tick);
      };
      tick();

      cleanupRef.current = cleanup;
    } catch {
      setTesting(false);
      setResult("error");
    }
  };

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={runTest} disabled={testing}>
        <Mic size={14} />
        {t("recording.testMic")}
      </Button>
      {testing && (
        <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(100, (level / 128) * 100)}%` }}
          />
        </div>
      )}
      {result === "ok" && !testing && (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 size={14} />
          {t("recording.micReady")}
        </span>
      )}
      {result === "error" && !testing && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <MicOff size={14} />
          {t("recording.micError")}
        </span>
      )}
    </div>
  );
}
