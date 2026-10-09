"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** Fades, lifts and un-blurs its children as they scroll into view. */
export function Reveal({ children, delay = 0, y = 28, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-reveal
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : `translateY(${y}px)`,
        filter: inView ? "none" : "blur(6px)",
        transition: `opacity 0.9s ${EASE}, transform 0.9s ${EASE}, filter 0.9s ${EASE}`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Heading whose words slide up one after another when it scrolls into view. */
export function WordReveal({
  text,
  level = 2,
  className,
  wordClassName,
  delay = 0,
}: {
  text: string;
  level?: 1 | 2;
  className?: string;
  wordClassName?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLHeadingElement>(0.4);
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <Heading ref={ref} className={className}>
      {text.split(" ").map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom">
          <span
            data-reveal
            className={cn("inline-block", wordClassName)}
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "none" : "translateY(115%)",
              transition: `opacity 0.8s ${EASE}, transform 0.8s ${EASE}`,
              transitionDelay: `${delay + i * 80}ms`,
            }}
          >
            {word}
          </span>
          {" "}
        </span>
      ))}
    </Heading>
  );
}

/** Card with a violet light that follows the cursor. */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        ref.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#fffdf8]/80 transition-all duration-500 hover:-translate-y-1 hover:border-violet-400/30",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(194, 65, 12,0.16), transparent 65%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
