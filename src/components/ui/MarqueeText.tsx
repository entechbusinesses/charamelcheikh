import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * One line of text. When it is wider than its box it scrolls in a loop so the
 * whole text can be read; otherwise it is shown as is.
 */
export default function MarqueeText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = textRef.current;
    if (!box || !span) return;
    const measure = () => setOverflow(span.scrollWidth > box.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div
      ref={boxRef}
      className={cn("min-w-0 overflow-hidden whitespace-nowrap", className)}
      title={text}
    >
      <span
        className={cn("inline-block", overflow && "marquee-track")}
        // ~1s per 6 characters, so long names don't fly by
        style={
          overflow
            ? { animationDuration: `${Math.max(5, text.length / 6)}s` }
            : undefined
        }
      >
        {/* same right gap on both copies, so -50% lands exactly on the 2nd */}
        <span ref={textRef} className={cn("inline-block", overflow && "pr-8")}>
          {text}
        </span>
        {overflow && (
          <span className="inline-block pr-8" aria-hidden>
            {text}
          </span>
        )}
      </span>
    </div>
  );
}
