import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin } from "lucide-react";
import { autocompletePlaces, type PlaceSuggestion } from "@/lib/maps.functions";
import { cn } from "@/lib/utils";

export type PlaceValue = { name: string; placeId: string | null };

type Props = {
  id: string;
  label: string;
  placeholder: string;
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  marker: "A" | "B";
};

export function PlaceInput({ id, label, placeholder, value, onChange, marker }: Props) {
  const fetchSuggestions = useServerFn(autocompletePlaces);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const tokenRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const typedRef = useRef(false);

  useEffect(() => {
    if (!typedRef.current) return;
    const text = value.name.trim();
    if (value.placeId || text.length < 2) {
      setItems([]);
      return;
    }
    const reqId = ++requestRef.current;
    const timer = setTimeout(async () => {
      if (!tokenRef.current) tokenRef.current = crypto.randomUUID();
      setLoading(true);
      try {
        const res = await fetchSuggestions({ data: { input: text, sessionToken: tokenRef.current } });
        if (reqId === requestRef.current) {
          setItems(res);
          setActive(-1);
          setOpen(true);
        }
      } catch (err) {
        console.error(err);
        if (reqId === requestRef.current) setItems([]);
      } finally {
        if (reqId === requestRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value.name, value.placeId, fetchSuggestions]);

  function choose(s: PlaceSuggestion) {
    const name = s.secondaryText ? `${s.mainText}, ${s.secondaryText}` : s.mainText;
    typedRef.current = false;
    tokenRef.current = null; // retire the autocomplete session after a selection
    requestRef.current++;
    onChange({ name, placeId: s.placeId });
    setOpen(false);
    setItems([]);
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <span
          className={cn(
            "absolute left-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold",
            marker === "A" ? "bg-primary text-primary-foreground" : "bg-signal text-signal-foreground",
          )}
          aria-hidden
        >
          {marker}
        </span>
        <input
          id={id}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={`${id}-list`}
          placeholder={placeholder}
          value={value.name}
          onChange={(e) => {
            typedRef.current = true;
            onChange({ name: e.target.value, placeId: null });
          }}
          onFocus={() => items.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || items.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              const s = items[active];
              if (s) choose(s);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-12 w-full rounded-lg border border-input bg-card pl-12 pr-10 text-[15px] font-medium shadow-sm outline-none transition placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && items.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lift"
        >
          {items.map((s, i) => (
            <li key={s.placeId} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-muted",
                  i === active && "bg-muted",
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.mainText}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.secondaryText}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">Suggestions by Google</li>
        </ul>
      )}
    </div>
  );
}
