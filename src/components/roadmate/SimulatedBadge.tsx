import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Marks anything that is a demo/concept rather than a real, confirmed integration. */
export function SimulatedBadge({ label = "Concept", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-simulated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-simulated-foreground",
        className,
      )}
    >
      <FlaskConical className="size-3" /> {label}
    </span>
  );
}
