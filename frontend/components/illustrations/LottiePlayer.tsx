"use client";

/**
 * Lottie with doodle fallback (R9a). Fetches /public/lottie/<name>.json;
 * missing/invalid JSON renders the hand-coded fallback. Plays only while
 * visible (IntersectionObserver); first frame only under reduced-motion.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lottie, type LottieHandle } from "lottie-react";

export function LottiePlayer({
  name,
  fallback,
  className = "h-48 w-64",
}: {
  name: string;
  fallback: ReactNode;
  className?: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lottieRef = useRef<LottieHandle>(null);

  useEffect(() => {
    let live = true;
    fetch(`/lottie/${name}.json`, { headers: { accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then((j) => {
        if (live) setData(j);
      })
      .catch(() => {
        if (live) setData(null);
      });
    return () => {
      live = false;
    };
  }, [name]);

  useEffect(() => {
    if (!data || !boxRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lottieRef.current?.stop();
      return;
    }
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) lottieRef.current?.play();
        else lottieRef.current?.pause();
      },
      { threshold: 0.1 }
    );
    ob.observe(boxRef.current);
    return () => ob.disconnect();
  }, [data]);

  if (!data) return <div className={className}>{fallback}</div>;
  return (
    <div ref={boxRef} className={className}>
      <Lottie lottieRef={lottieRef} src={data} loop autoplay />
    </div>
  );
}
