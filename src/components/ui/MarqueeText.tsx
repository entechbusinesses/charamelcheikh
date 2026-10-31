import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * One line of text. When it is wider than its box it scrolls in a loop so the
 * whole text can be read; otherwise it is shown as is.
 *
 * Scrolling must not change the box's intrinsic width: in an auto-width
 * parent (POS categories panel) a wider box made the text fit, which stopped
 * the scrolling, which narrowed the box again: the panel shook. So the copy
 * is out of flow and the text span keeps the same size in both states.
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
        className={cn("relative inline-block", overflow && "marquee-track")}
        // ~1s per 6 characters, so long names don't fly by
        style={
          overflow
            ? { animationDuration: `${Math.max(5, text.length / 6)}s` }
            : undefined
        }
      >
        <span ref={textRef} className="inline-block">
          {text}
        </span>
        {/* 2rem after the text; the track moves by its width + 2rem (index.css) */}
        {overflow && (
          <span className="absolute left-full top-0 pl-8" aria-hidden>
            {text}
          </span>
        )}
      </span>
    </div>
  );
}
