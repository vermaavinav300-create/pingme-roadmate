import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, Gauge, Lock, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/roadmate/AppHeader";
import { RouteMap } from "@/components/roadmate/RouteMap";
import { RoutePlacesDiscovery } from "@/components/roadmate/RoutePlacesDiscovery";
import { Button } from "@/components/ui/button";
import { deleteJourney, getJourney } from "@/lib/journeys.functions";
import { getRoutePlaces } from "@/lib/places.functions";
import { formatDistance, formatDuration, type RouteOption } from "@/lib/route-utils";
import type { RoutePlace } from "@/lib/places-utils";

const journeyQuery = (id: string) =>
  queryOptions({ queryKey: ["journey", id], queryFn: () => getJourney({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/journeys/$journeyId")({
  head: () => ({
    meta: [
      { title: "Journey — PingME RoadMate" },
      { name: "description", content: "Your locked driving route on the map." },
      { property: "og:title", content: "Journey — PingME RoadMate" },
      { property: "og:description", content: "Your locked driving route on the map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const row = await context.queryClient.ensureQueryData(journeyQuery(params.journeyId));
    if (!row) throw notFound();
    return row;
  },
  notFoundComponent: () => (
    <div className="min-h-screen">
      <AppHeader />
      <div className="p-10 text-center">
        <p className="font-semibold">Journey not found.</p>
        <Link to="/journeys" className="text-primary underline">Back to My Journeys</Link>
      </div>
    </div>
  ),
  component: JourneyPage,
});

function JourneyPage() {
  const { journeyId } = Route.useParams();
  const { data: j } = useSuspenseQuery(journeyQuery(journeyId));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useServerFn(deleteJourney);
  const fetchPlaces = useServerFn(getRoutePlaces);

  const [deleting, setDeleting] = useState(false);
  const [places, setPlaces] = useState<RoutePlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [maxDetourKm, setMaxDetourKm] = useState(5);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const route = useMemo<RouteOption[]>(
    () =>
      j
        ? [
            {
              index: j.route_index,
              description: j.route_description ?? "",
              labels: [],
              distanceMeters: j.distance_meters,
              durationSeconds: j.duration_seconds,
              encodedPolyline: j.encoded_polyline,
              warnings: [],
              start: { lat: j.origin_lat, lng: j.origin_lng },
              end: { lat: j.destination_lat, lng: j.destination_lng },
            },
          ]
        : [],
    [j],
  );

  // Fetch Stage 2 places along the corridor using Overpass API
  useEffect(() => {
    if (!j?.encoded_polyline) return;
    let active = true;
    setLoadingPlaces(true);

    fetchPlaces({
      data: {
        encodedPolyline: j.encoded_polyline,
        searchRadiusM: 10000,
      },
    })
      .then((res) => {
        if (active) {
          setPlaces(res.places);
        }
      })
      .catch((err) => {
        console.error("Could not load stops along route:", err);
      })
      .finally(() => {
        if (active) setLoadingPlaces(false);
      });

    return () => {
      active = false;
    };
  }, [j?.encoded_polyline, fetchPlaces]);

  if (!j) return null;

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        <aside className="w-full overflow-y-auto border-r p-5 lg:w-[460px]">
          <Link to="/journeys" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> My Journeys
          </Link>

          <div className="signboard p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Locked route</p>
            <p className="mt-2 font-display text-lg font-bold leading-snug">
              <span className="opacity-70">A</span> {j.origin_name}
            </p>
            <p className="mt-1 font-display text-lg font-bold leading-snug">
              <span className="text-signal">B</span> {j.destination_name}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              {j.route_description && <span className="nh-plate">{j.route_description}</span>}
              <span className="flex items-center gap-1"><Clock className="size-4" /> {formatDuration(j.duration_seconds)}</span>
              <span className="flex items-center gap-1"><Gauge className="size-4" /> {formatDistance(j.distance_meters)}</span>
            </div>
          </div>

          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            This is the exact route you selected. RoadMate never re-routes you silently — to change it, plan a new trip.
          </p>

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-bold">Stops along this route</h2>
            <RoutePlacesDiscovery
              places={places}
              loading={loadingPlaces}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={(place) => setSelectedPlaceId(place.id)}
              maxDetourKm={maxDetourKm}
              onMaxDetourChange={setMaxDetourKm}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mt-8 text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={async () => {
              if (!confirm("Delete this journey?")) return;
              setDeleting(true);
              try {
                await remove({ data: { id: j.id } });
                await queryClient.invalidateQueries({ queryKey: ["journeys"] });
                toast.success("Journey deleted");
                navigate({ to: "/journeys" });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not delete");
                setDeleting(false);
              }
            }}
          >
            <Trash2 /> Delete journey
          </Button>
        </aside>
        <RouteMap
          routes={route}
          selectedIndex={j.route_index}
          places={places.filter((p) => (p.distanceFromRouteM * 2) <= maxDetourKm * 1000)}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={(place) => setSelectedPlaceId(place.id)}
          className="h-[42vh] w-full lg:h-auto lg:flex-1"
        />
      </div>
    </div>
  );
}
