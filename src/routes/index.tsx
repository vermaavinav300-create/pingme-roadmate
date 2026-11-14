import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, BellRing, Fuel, Hotel, QrCode, Route as RouteIcon, UtensilsCrossed, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PingMeMark } from "@/components/roadmate/PingMeMark";
import { VehicleQrModal } from "@/components/roadmate/VehicleQrModal";
import heroImg from "@/assets/highway-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PingME RoadMate — food, fuel & stays on your route" },
      {
        name: "description",
        content:
          "Pick your driving route and RoadMate shows restaurants, petrol pumps and hotels that are actually on it — with detour time.",
      },
      { property: "og:title", content: "PingME RoadMate — food, fuel & stays on your route" },
      {
        property: "og:description",
        content: "Restaurants, petrol pumps and hotels along the exact route you choose.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: RouteIcon, title: "Pick your route", body: "Compare real driving routes and lock the one you like." },
  { icon: UtensilsCrossed, title: "See stops on it", body: "Food, fuel and stays ranked by how far off your road they are." },
  { icon: BellRing, title: "Get pinged", body: "An alert before you reach each stop you chose. Your route never changes." },
];

function Landing() {
  const [showQrModal, setShowQrModal] = useState(false);

  return (
    <div className="min-h-screen">
      <VehicleQrModal open={showQrModal} onOpenChange={setShowQrModal} />
      <section className="relative isolate flex min-h-[88vh] flex-col overflow-hidden">
        <img
          src={heroImg}
          alt="A car on an Indian highway at golden hour"
          width={1600}
          height={1008}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="hero-scrim absolute inset-0 -z-10" />

        <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-5 text-on-image">
          <PingMeMark />
          <span className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold opacity-80">PingME</span>
            <span className="opacity-60">/</span>
            <span className="font-display text-lg font-bold">RoadMate</span>
          </span>
          <Button asChild variant="onImage" size="sm" className="ml-auto">
            <Link to="/journeys">My Journeys</Link>
          </Button>
        </header>

        <div className="mx-auto mt-auto w-full max-w-6xl px-6 pb-16 text-on-image">
          <p className="nh-plate mb-5 animate-rise">New on PingME</p>
          <h1 className="max-w-3xl animate-rise text-5xl font-extrabold leading-[1.02] sm:text-7xl">
            Every stop on your road.
            <br />
            <span className="text-signal">None off it.</span>
          </h1>
          <p className="mt-5 max-w-xl animate-rise text-lg opacity-90">
            Choose your driving route, then find restaurants, petrol pumps and hotels that sit along it — with the
            exact detour each one costs you.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="signal" size="xl">
              <Link to="/plan">
                Plan a road trip <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
        <div className="road-dashes h-1 w-full bg-asphalt" />
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-2xl border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-muted-foreground">0{i + 1}</span>
              <s.icon className="size-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="signboard grid gap-8 p-8 sm:grid-cols-[1.4fr_1fr] sm:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Inside the PingME super app</p>
            <h2 className="mt-2 text-3xl font-extrabold">Your car's PingME QR, now a trip companion.</h2>
            <p className="mt-3 max-w-lg opacity-90">
              Generate an official PingME tag for your vehicle to launch RoadMate, and create a live journey QR so family can follow your planned route.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                variant="signal"
                size="lg"
                className="font-bold gap-2"
                onClick={() => setShowQrModal(true)}
              >
                <QrCode className="size-4" /> Open Vehicle & Trip QR Generator
              </Button>
            </div>
          </div>
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-6 cursor-pointer rounded-2xl bg-black/20 p-6 transition hover:bg-black/30"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="size-24 text-signal animate-pulse" />
            <div className="grid gap-3 text-sm font-semibold">
              <span className="flex items-center gap-2"><UtensilsCrossed className="size-4 text-signal" /> Restaurants</span>
              <span className="flex items-center gap-2"><Fuel className="size-4 text-signal" /> Petrol pumps</span>
              <span className="flex items-center gap-2"><Hotel className="size-4 text-signal" /> Hotels</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        PingME RoadMate · hackathon prototype · Map data © OpenStreetMap contributors
      </footer>
    </div>
  );
}
