"use client";

/** #2/#3 CHAT CHIP — owner (green) / AI (white). Text is ATOMIC: one span, never split. */
export default function ChatChip({ kind, line }: { kind: "owner" | "ai"; line: string }) {
  const owner = kind === "owner";
  return (
    <div
      className="hf-chip"
      style={{
        background: owner ? "#DCF8C6" : "#FFFFFF",
        borderTopRightRadius: owner ? 4 : 14,
        borderTopLeftRadius: owner ? 14 : 4,
      }}
    >
      <span data-hf="chat-typing" className="hf-typing hf-rest0" aria-hidden="true">
        {[0, 1, 2].map((d) => (
          <i key={d} />
        ))}
      </span>
      <span data-hf="chat-line" className="hf-chatline">
        {line}
      </span>
    </div>
  );
}
