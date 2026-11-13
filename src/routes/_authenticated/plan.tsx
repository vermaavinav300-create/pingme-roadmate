import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownUp, Check, Clock, Gauge, Loader2, Lock, Navigation, TriangleAlert } from "lucide-react";
import { AppHeader } from "@/components/roadmate/AppHeader";
import { PlaceInput, type PlaceValue } from "@/components/roadmate/PlaceInput";
import { RouteMap } from "@/components/roadmate/RouteMap";
import { Button } from "@/components/ui/button";
import { computeDrivingRoutes } from "@/lib/maps.functions";
import { saveJourney } from "@/lib/journeys.functions";
import { formatDistance, formatDuration, routeTitle, type RouteOption } from "@/lib/route-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Plan a trip — PingME RoadMate" },
      { name: "description", content: "Enter start and destination, compare driving routes and lock one in." },
      { property: "og:title", content: "Plan a trip — PingME RoadMate" },
      { property: "og:description", content: "Compare driving routes and lock one in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

const EMPTY: PlaceValue = { name: "", placeId: null };
const SAMPLES: Array<[string, string]> = [
  ["New Delhi", "Jaipur"],
  ["Mumbai", "Pune"],
  ["Bengaluru", "Mysuru"],
];

function PlanPage() {
  const navigate = useNavigate();
  const findRoutes = useServerFn(computeDrivingRoutes);
  const save = useServerFn(saveJourney);
  const [origin, setOrigin] = useState<PlaceValue>(EMPTY);
  const [destination, setDestination] = useState<PlaceValue>(EMPTY);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [searched, setSearched] = useState<{ origin: PlaceValue; destination: PlaceValue } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fastest = useMemo(
    () => routes.reduce<RouteOption | null>((b, r) => (!b || r.durationSeconds < b.durationSeconds ? r : b), null)?.index,
    [routes],
  );
  const shortest = useMemo(
    () => routes.reduce<RouteOption | null>((b, r) => (!b || r.distanceMeters < b.distanceMeters ? r : b), null)?.index,
    [routes],
  );
  const selectedRoute = routes.find((r) => r.index === selected) ?? null;

  async function search(o = origin, d = destination) {
    if (o.name.trim().length < 2 || d.name.trim().length < 2) {
      toast.error("Enter both a starting point and a destination.");
      return;
    }
    setLoading(true);
    setRoutes([]);
    setSelected(null);
    try {
      const res = await findRoutes({
        data: {
          origin: { name: o.name, placeId: o.placeId },
          destination: { name: d.name, placeId: d.placeId },
        },
      });
      setRoutes(res.routes);
      setSearched({ origin: o, destination: d });
      if (res.routes.length === 0) toast.error("No driving route found between these places.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not fetch routes");
    } finally {
      setLoading(false);
    }
  }

  async function lockIn() {
    if (!selectedRoute || !searched) return;
    setSaving(true);
    try {
      const { id } = await save({
        data: {
          origin: { name: searched.origin.name, placeId: searched.origin.placeId },
          destination: { name: searched.destination.name, placeId: searched.destination.placeId },
          route: selectedRoute,
        },
      });
      toast.success("Journey saved");
      navigate({ to: "/journeys/$journeyId", params: { journeyId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save journey");
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        <aside className="flex min-h-0 w-full flex-col overflow-y-auto border-r bg-background lg:w-[440px]">
          <form
            className="grid gap-3 border-b p-5"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <h1 className="text-2xl font-extrabold">Where are you driving?</h1>
            <PlaceInput id="origin" label="Start" marker="A" placeholder="e.g. Connaught Place, Delhi" value={origin} onChange={setOrigin} />
            <div className="-my-1 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Swap start and destination"
                onClick={() => {
                  setOrigin(destination);
                  setDestination(origin);
                }}
              >
                <ArrowDownUp /> Swap
              </Button>
            </div>
            <PlaceInput id="destination" label="Destination" marker="B" placeholder="e.g. Hawa Mahal, Jaipur" value={destination} onChange={setDestination} />
            <Button type="submit" size="xl" disabled={loading} className="mt-1">
              {loading ? <Loader2 className="animate-spin" /> : <Navigation />} Find driving routes
            </Button>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Try:
              {SAMPLES.map(([a, b]) => (
                <button
                  key={a}
                  type="button"
                  className="rounded-full border bg-card px-2.5 py-1 font-semibold text-foreground transition hover:border-primary"
                  onClick={() => {
                    const o = { name: a, placeId: null };
                    const d = { name: b, placeId: null };
                    setOrigin(o);
                    setDestination(d);
                    search(o, d);
                  }}
                >
                  {a} → {b}
                </button>
              ))}
            </div>
          </form>

          <div className="flex-1 p-5">
            {loading && (
              <div className="grid gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            )}

            {!loading && routes.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Your route options will appear here. Pick one, and RoadMate will only ever show stops along it.
              </div>
            )}

            {!loading && routes.length > 0 && (
              <div className="grid gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {routes.length} route{routes.length > 1 ? "s" : ""} found · tap one to select
                </p>
                {routes.map((r) => {
                  const isSel = r.index === selected;
                  return (
                    <button
                      key={r.index}
                      type="button"
                      onClick={() => setSelected(r.index)}
                      aria-pressed={isSel}
                      className={cn(
                        "group relative rounded-xl border bg-card p-4 text-left transition hover:shadow-lift",
                        isSel && "border-primary ring-2 ring-primary",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {r.description ? <span className="nh-plate">{r.description}</span> : <span className="font-bold">Route {r.index + 1}</span>}
                            {r.index === fastest && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">Fastest</span>}
                            {r.index === shortest && r.index !== fastest && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">Shortest</span>}
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5 font-display text-xl font-bold">
                              <Clock className="size-4 text-primary" />
                              {formatDuration(r.durationSeconds)}
                            </span>
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Gauge className="size-4" />
                              {formatDistance(r.distanceMeters)}
                            </span>
                          </div>
                          {r.warnings.length > 0 && (
                            <ul className="mt-2 grid gap-0.5 text-xs text-muted-foreground">
                              {r.warnings.slice(0, 2).map((w) => (
                                <li key={w} className="flex items-center gap-1">
                                  <TriangleAlert className="size-3 text-warning" /> {w}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                            isSel ? "border-primary bg-primary text-primary-foreground" : "border-border",
                          )}
                        >
                          {isSel && <Check className="size-3.5" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
                <p className="text-[11px] text-muted-foreground">Times are typical, without live traffic. Route data © Google.</p>
              </div>
            )}
          </div>

          {selectedRoute && (
            <div className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur">
              <Button variant="signal" size="xl" className="w-full" onClick={lockIn} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Lock />} Lock in {routeTitle(selectedRoute)}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Saved to My Journeys. RoadMate never changes this route for you.
              </p>
            </div>
          )}
        </aside>

        <RouteMap
          routes={routes}
          selectedIndex={selected}
          onSelect={setSelected}
          className="h-[42vh] w-full lg:h-auto lg:flex-1"
        />
      </div>
    </div>
  );
}
