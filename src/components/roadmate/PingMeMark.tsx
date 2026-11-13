import { cn } from "@/lib/utils";

/** RoadMate mark: a highway-green tile with signal-amber "ping" arcs. */
export function PingMeMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-8 items-center justify-center rounded-lg bg-primary text-signal",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="8" cy="16" r="2.2" fill="currentColor" stroke="none" />
        <path d="M8 10.5a5.5 5.5 0 0 1 5.5 5.5" />
        <path d="M8 5a11 11 0 0 1 11 11" />
      </svg>
    </span>
  );
}
