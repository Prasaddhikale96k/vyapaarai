"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mic, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AgentSteps } from "@/components/chat/agent-steps";
import { MessageBubble } from "@/components/chat/message-bubble";
import { SuggestedChips } from "@/components/chat/suggested-chips";
import { FadeIn } from "@/components/fade-in";
import { apiFetch, fmtClock, type AgentStep, type ChatResp } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

interface Msg {
  id: number;
  role: "user" | "ai";
  content: string;
  time: Date;
  steps?: AgentStep[];
  provider?: string;
  source?: "web" | "whatsapp";
}

interface HistoryRow {
  id: number;
  role: string;
  content: string;
  source: string;
  created_at: string | null;
}

const STATUS_STEPS = [
  "🧭 Planning…",
  "📊 Sales agent dekh raha hai…",
  "📦 Inventory agent dekh raha hai…",
  "💰 Finance agent dekh raha hai…",
  "✍️ Synthesizing…",
];

const SUGGESTIONS = [
  "Profit kyun gira?",
  "Parle-G ka stock kab khatam hoga?",
  "Kaunsa product bechna band karoon?",
  "Udhaar kitna atka hai?",
];

let idCounter = 1;

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [suggested, setSuggested] = useState<ChatResp["suggested_actions"]>([]);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [listening, setListening] = useState(false);
  const [levels, setLevels] = useState<number[]>(new Array(18).fill(2));
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waiting]);

  // Unified thread: server truth replaces local list (no dupes, ever)
  const loadHistory = async () => {
    try {
      const rows = await apiFetch<HistoryRow[]>("/chat/history");
      if (!Array.isArray(rows)) return;
      setMessages(
        rows.map((r) => ({
          id: -(r.id ?? 0) - 1, // negative: never collides with local counter
          role: r.role === "assistant" ? ("ai" as const) : ("user" as const),
          content: r.content ?? "",
          time: r.created_at ? new Date(r.created_at) : new Date(),
          source: r.source === "whatsapp" ? ("whatsapp" as const) : ("web" as const),
        }))
      );
    } catch {
      /* offline/history empty — local thread continues */
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useRealtime(["chat_messages"], () => {
    loadHistory();
  });

  useEffect(() => {
    if (!waiting) return;
    setStatusIdx(0);
    const t = setInterval(() => setStatusIdx((i) => (i + 1) % STATUS_STEPS.length), 1400);
    return () => clearInterval(t);
  }, [waiting]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || waiting) return;
    setInput("");
    setMessages((m) => [...m, { id: idCounter++, role: "user", content: msg, time: new Date() }]);
    setWaiting(true);
    try {
      const res = await apiFetch<ChatResp>("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      setMessages((m) => [
        ...m,
        {
          id: idCounter++,
          role: "ai",
          content: res.answer,
          time: new Date(),
          steps: res.steps ?? [],
          provider: res.provider,
        },
      ]);
      setSuggested(res.suggested_actions ?? []);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Kuch gadbad ho gayi";
      toast.error(errMsg);
      setMessages((m) => [
        ...m,
        { id: idCounter++, role: "ai", content: `⚠️ ${errMsg} — dobara try karo 🙏`, time: new Date() },
      ]);
    } finally {
      setWaiting(false);
    }
  };

  const lastAiSteps = [...messages].reverse().find((m) => m.role === "ai" && m.steps?.length)?.steps;

  const stopTracks = () => {
    try {
      recRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    try {
      audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    cancelAnimationFrame(rafRef.current);
  };

  const toggleRec = async () => {
    if (recording) {
      try {
        recRef.current?.stop();
      } catch {
        setRecording(false);
        stopTracks();
      }
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as DOMException)?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError")
        toast.error("🙏 Mic permission chahiye — browser settings mein allow karo");
      else if (name === "NotFoundError" || name === "OverconstrainedError")
        toast.error("Koi mic nahi mila — device check karo 🎤");
      else toast.error("Mic start nahi hua — dobara try karo");
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        try {
          analyser.getByteFrequencyData(buf);
          const n = 18;
          const lv: number[] = [];
          for (let i = 0; i < n; i++) {
            const v = buf[Math.floor((i / n) * buf.length)] ?? 0;
            lv.push(2 + (v / 255) * 18);
          }
          setLevels(lv);
        } catch {
          /* ignore */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      /* waveform optional — recording continues */
    }
    try {
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        setRecording(false);
        stopTracks();
        toast.error("Record fail ho gaya — dobara try karo");
      };
      rec.onstop = async () => {
        setRecording(false);
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) {
          toast.error("Kuch record nahi hua — dobara bolo 🎤");
          return;
        }
        setListening(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          const res = await apiFetch<ChatResp & { transcript?: string }>("/chat/voice", {
            method: "POST",
            body: fd,
          });
          const tr = (res.transcript || "").trim();
          setMessages((m) => [
            ...m,
            { id: idCounter++, role: "user", content: tr ? `🎤 ${tr}` : "🎤 voice note", time: new Date() },
            {
              id: idCounter++,
              role: "ai",
              content: res.answer,
              time: new Date(),
              steps: res.steps ?? [],
              provider: res.provider,
            },
          ]);
          setSuggested(res.suggested_actions ?? []);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Voice fail ho gaya");
        } finally {
          setListening(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setRecSecs(0);
      timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      stopTracks();
      toast.error("Record start nahi hua — dobara try karo");
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col md:h-[calc(100vh-4rem)]">
      <FadeIn>
        <h1 className="text-xl font-bold text-zinc-50">Copilot Chat</h1>
        <p className="mb-3 text-xs text-zinc-400">Business sawal poochho — sales, stock, udhaar sab.</p>
      </FadeIn>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
        {messages.length === 0 && !waiting && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-4xl">🪔</p>
            <p className="text-sm text-zinc-400">
              Namaste! Main VyapaarAI hoon.
              <br />
              Neeche se ek sawal try karo 👇
            </p>
            <div className="flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} time={m.time} source={m.source} />
        ))}

        <AnimatePresence>
          {waiting && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-300">
                <motion.span
                  key={statusIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    className="inline-block"
                  >
                    ⏳
                  </motion.span>
                  {STATUS_STEPS[statusIdx]}
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {lastAiSteps && lastAiSteps.length > 0 && <AgentSteps steps={lastAiSteps} />}
        {suggested.length > 0 && <SuggestedChips items={suggested} />}
        {listening && (
          <div className="shimmer rounded-2xl px-3.5 py-2.5 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
            🎧 Sun raha hoon… jawab ban raha hai
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 mt-3 flex items-center gap-2 rounded-2xl border p-2 backdrop-blur"
        style={{ borderColor: "var(--card-border)", background: "color-mix(in srgb, var(--card) 88%, transparent)" }}>
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            title={recording ? `Stop (${Math.floor(recSecs / 60)}:${String(recSecs % 60).padStart(2, "0")})` : "Voice note record karo"}
            onClick={toggleRec}
            className="rounded-xl p-2.5"
            style={{
              color: recording ? "#fff" : "var(--ink-soft)",
              background: recording ? "var(--rose)" : "transparent",
            }}
            animate={recording ? { scale: [1, 1.12, 1] } : {}}
            transition={recording ? { repeat: Infinity, duration: 1.2 } : {}}
          >
            {recording ? <Square size={18} /> : <Mic size={18} />}
          </motion.button>
          {recording && (
            <div className="flex items-center gap-1.5">
              <span className="tnum text-xs font-bold" style={{ color: "var(--rose)" }}>
                {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")}
              </span>
              <div className="flex h-6 items-center gap-[2px]">
                {levels.map((h, i) => (
                  <span key={i} className="w-[3px] rounded-full" style={{ height: h, background: "var(--rose)" }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Apna sawal likho… (Enter dabao)"
          className="flex-1 bg-transparent px-2 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => send(input)}
          disabled={waiting || !input.trim()}
          className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 p-2.5 text-zinc-950 disabled:opacity-40"
        >
          <Send size={18} />
        </motion.button>
      </div>
      <p className="mt-1 text-center text-[11px] text-zinc-600">
        {waiting ? STATUS_STEPS[statusIdx] : `Last reply ${messages.length ? fmtClock(messages[messages.length - 1].time) : "—"}`}
      </p>
    </div>
  );
}
