import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, Route as RouteIcon } from "lucide-react";
import { AppHeader } from "@/components/roadmate/AppHeader";
import { Button } from "@/components/ui/button";
import { listJourneys } from "@/lib/journeys.functions";
import { formatDistance, formatDuration } from "@/lib/route-utils";

const journeysQuery = queryOptions({ queryKey: ["journeys"], queryFn: () => listJourneys() });

export const Route = createFileRoute("/_authenticated/journeys/")({
  head: () => ({
    meta: [
      { title: "My Journeys — PingME RoadMate" },
      { name: "description", content: "Your saved road trips and locked routes." },
      { property: "og:title", content: "My Journeys — PingME RoadMate" },
      { property: "og:description", content: "Your saved road trips and locked routes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(journeysQuery),
  component: JourneysPage,
});

function JourneysPage() {
  const { data: journeys } = useSuspenseQuery(journeysQuery);
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">My Journeys</h1>
            <p className="text-sm text-muted-foreground">Routes you've locked in.</p>
          </div>
          <Button asChild>
            <Link to="/plan">
              <Plus /> New trip
            </Link>
          </Button>
        </div>

        {journeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <RouteIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-semibold">No journeys yet</p>
            <p className="text-sm text-muted-foreground">Plan a trip and lock a route to see it here.</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {journeys.map((j) => (
              <li key={j.id}>
                <Link
                  to="/journeys/$journeyId"
                  params={{ journeyId: j.id }}
                  className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition hover:shadow-lift"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold">
                      {j.origin_name.split(",")[0]} → {j.destination_name.split(",")[0]}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {j.route_description && <span className="nh-plate">{j.route_description}</span>}
                      <span>{formatDuration(j.duration_seconds)}</span>·<span>{formatDistance(j.distance_meters)}</span>·
                      <span>{new Date(j.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    </div>
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
