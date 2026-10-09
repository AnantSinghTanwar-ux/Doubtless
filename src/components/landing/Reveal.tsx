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

/** Fades and lifts its children slightly as they scroll into view. */
export function Reveal({ children, delay = 0, y = 14, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-reveal
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : `translateY(${y}px)`,
        transition: `opacity 0.7s ${EASE}, transform 0.7s ${EASE}`,
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
  /** 0 renders a block span, for use inside a heading you provide. */
  level?: 0 | 1 | 2;
  className?: string;
  wordClassName?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLHeadingElement>(0.4);
  const Heading = level === 1 ? "h1" : level === 0 ? "span" : "h2";
  return (
    <Heading ref={ref} className={cn(level === 0 && "block", className)}>
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
