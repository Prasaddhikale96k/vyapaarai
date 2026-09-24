"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <h1 className="font-display text-3xl font-bold">Kuch gadbad ho gayi 🙏</h1>
          <p className="mt-2 text-sm opacity-70">Refresh karo — theek ho jayega.</p>
          <button
            onClick={reset}
            className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            Dobara try karo
          </button>
        </main>
      </body>
    </html>
  );
}
