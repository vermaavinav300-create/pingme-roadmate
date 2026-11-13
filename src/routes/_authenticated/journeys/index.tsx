import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock,
  Gauge,
  MapPin,
  Navigation,
  Plus,
  Route as RouteIcon,
  Trash2,
  Edit2,
  UtensilsCrossed,
  Fuel,
  Hotel,
  SlidersHorizontal,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Smartphone,
  Car,
  Banknote,
  RotateCcw,
  Check,
  Compass,
  Calendar,
  Phone,
  User,
  ShieldCheck,
  BellRing,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { AppHeader } from "@/components/roadmate/AppHeader";
import { RouteMap } from "@/components/roadmate/RouteMap";
import { DrivingSimulationPanel } from "@/components/roadmate/DrivingSimulationPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  listJourneys,
  getJourney,
  renameJourney,
  deleteJourney,
  listJourneyStops,
  removeJourneyStop,
  getUserPreferences,
  saveUserPreferences,
} from "@/lib/journeys.functions";
import {
  listOrdersAndReservations,
  advanceOrderStatus,
  advanceReservationStatus,
} from "@/lib/orders.functions";
import { formatDistance, formatDuration, type RouteOption, type LatLng } from "@/lib/route-utils";
import type { RoutePlace } from "@/lib/places-utils";
import type { DbJourneyStop, DbOrder, DbReservation, UserPreferences } from "@/lib/orders-db.server";

type JourneysSearch = {
  journeyId?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/journeys/")({
  validateSearch: (search: Record<string, unknown>): JourneysSearch => ({
    journeyId: typeof search["journeyId"] === "string" ? search["journeyId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "My Journey — PingME RoadMate" },
      { name: "description", content: "Your saved route, upcoming stops, advance orders and trip preferences." },
      { property: "og:title", content: "My Journey — PingME RoadMate" },
      { property: "og:description", content: "Your saved route, upcoming stops, advance orders and trip preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyJourneyPage,
});

function stopToRoutePlace(stop: DbJourneyStop): RoutePlace {
  return {
    id: stop.placeId,
    name: stop.name,
    category: stop.category,
    kind: stop.kind,
    lat: stop.lat,
    lng: stop.lng,
    distanceFromRouteM: stop.distanceFromRouteM,
    alongRouteM: stop.alongRouteM,
    address: stop.address ?? null,
    phone: stop.phone ?? null,
    openingHours: stop.openingHours ?? null,
    osmType: "node",
  };
}

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-3" /> Confirmed (simulated)
        </span>
      );
    case "sent_to_restaurant":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-700 dark:text-sky-400">
          <Clock className="size-3" /> Sent to restaurant (simulated)
        </span>
      );
    case "submitted":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
          <Clock className="size-3" /> Submitted
        </span>
      );
  }
}

function MyJourneyPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  // Server functions
  const listJourneysFn = useServerFn(listJourneys);
  const getJourneyFn = useServerFn(getJourney);
  const renameJourneyFn = useServerFn(renameJourney);
  const deleteJourneyFn = useServerFn(deleteJourney);
  const listStopsFn = useServerFn(listJourneyStops);
  const removeStopFn = useServerFn(removeJourneyStop);
  const listOrdersFn = useServerFn(listOrdersAndReservations);
  const advanceOrderFn = useServerFn(advanceOrderStatus);
  const advanceReservationFn = useServerFn(advanceReservationStatus);
  const getPrefsFn = useServerFn(getUserPreferences);
  const savePrefsFn = useServerFn(saveUserPreferences);

  // Core Data States
  const [journeys, setJourneys] = useState<any[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [activeJourneyDetails, setActiveJourneyDetails] = useState<any | null>(null);
  const [stops, setStops] = useState<DbJourneyStop[]>([]);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [reservations, setReservations] = useState<DbReservation[]>([]);
  const [loadingJourneys, setLoadingJourneys] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [carPosition, setCarPosition] = useState<LatLng | null>(null);

  const handleSelectStopFromSim = (placeId: string) => {
    setSelectedPlaceId(placeId);
    const el = document.getElementById(`stop-card-${placeId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Preferences State
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [prefDetourKm, setPrefDetourKm] = useState<number>(5);
  const [prefFood, setPrefFood] = useState<"any" | "veg" | "non-veg">("any");
  const [prefAlertDistance, setPrefAlertDistance] = useState<number>(5);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Rename Dialog State
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete Confirm Dialog State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 1. Load all journeys on mount
  const refreshJourneys = async () => {
    setLoadingJourneys(true);
    try {
      const list = await listJourneysFn();
      setJourneys(list);

      // Determine which journey to select
      let targetId: string | null = null;
      if (search.journeyId && list.some((j: any) => j.id === search.journeyId)) {
        targetId = search.journeyId;
      } else if (list.length > 0) {
        targetId = list[0].id;
      }

      setSelectedJourneyId(targetId);
    } catch (err) {
      toast.error("Could not load journeys.");
    } finally {
      setLoadingJourneys(false);
    }
  };

  useEffect(() => {
    refreshJourneys();
  }, []);

  // 2. Load user preferences on mount
  useEffect(() => {
    getPrefsFn()
      .then((res) => {
        if (res.preferences) {
          setUserPreferences(res.preferences);
          setPrefDetourKm(res.preferences.preferredMaxDetourKm || 5);
          setPrefFood(res.preferences.foodPreference || "any");
          setPrefAlertDistance(res.preferences.alertDistanceKm || 5);
        }
      })
      .catch(() => {});
  }, []);

  // 3. Load active journey details, stops, and orders/reservations whenever selectedJourneyId changes
  useEffect(() => {
    if (!selectedJourneyId) {
      setActiveJourneyDetails(null);
      setStops([]);
      setOrders([]);
      setReservations([]);
      return;
    }

    let active = true;
    setLoadingDetails(true);

    Promise.all([
      getJourneyFn({ data: { id: selectedJourneyId } }),
      listStopsFn({ data: { journeyId: selectedJourneyId } }),
      listOrdersFn(),
    ])
      .then(([journeyRow, stopsRes, ordersRes]) => {
        if (!active) return;
        setActiveJourneyDetails(journeyRow);
        setStops(stopsRes.stops);
        setOrders(ordersRes.orders);
        setReservations(ordersRes.reservations);
      })
      .catch((err) => {
        console.error("Error loading journey details:", err);
        toast.error("Could not load journey details.");
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [selectedJourneyId]);

  // Handler to switch active journey
  const handleSelectJourney = (id: string) => {
    setSelectedJourneyId(id);
    navigate({ search: { journeyId: id } });
  };

  // Convert active journey to RouteOption for RouteMap
  const activeRouteOptions = useMemo<RouteOption[]>(() => {
    if (!activeJourneyDetails) return [];
    return [
      {
        index: activeJourneyDetails.route_index ?? 0,
        description: activeJourneyDetails.route_description ?? "",
        labels: [],
        distanceMeters: activeJourneyDetails.distance_meters,
        durationSeconds: activeJourneyDetails.duration_seconds,
        encodedPolyline: activeJourneyDetails.encoded_polyline,
        warnings: [],
        start: { lat: activeJourneyDetails.origin_lat, lng: activeJourneyDetails.origin_lng },
        end: { lat: activeJourneyDetails.destination_lat, lng: activeJourneyDetails.destination_lng },
      },
    ];
  }, [activeJourneyDetails]);

  // Convert stops to RoutePlaces for RouteMap
  const stopsAsPlaces = useMemo<RoutePlace[]>(() => {
    return stops.map(stopToRoutePlace);
  }, [stops]);

  // Filter orders & reservations relevant to this journey
  const journeyOrders = useMemo(() => {
    if (!selectedJourneyId) return [];
    const stopPlaceIds = new Set(stops.map((s) => s.placeId));
    return orders.filter(
      (o) => o.journeyId === selectedJourneyId || stopPlaceIds.has(o.restaurantId),
    );
  }, [orders, selectedJourneyId, stops]);

  const journeyReservations = useMemo(() => {
    if (!selectedJourneyId) return [];
    const stopPlaceIds = new Set(stops.map((s) => s.placeId));
    return reservations.filter(
      (r) => r.journeyId === selectedJourneyId || stopPlaceIds.has(r.restaurantId),
    );
  }, [reservations, selectedJourneyId, stops]);

  // Handlers
  const handleRemoveStop = async (stopId: string, stopName: string) => {
    try {
      await removeStopFn({ data: { stopId } });
      setStops((prev) => prev.filter((s) => s.id !== stopId));
      toast.success(`Removed ${stopName} from upcoming stops.`);
    } catch {
      toast.error("Failed to remove stop.");
    }
  };

  const handleOpenRename = () => {
    if (!activeJourneyDetails) return;
    setRenameTitle(
      activeJourneyDetails.route_description ||
        `${activeJourneyDetails.origin_name.split(",")[0]} to ${activeJourneyDetails.destination_name.split(",")[0]}`,
    );
    setRenameOpen(true);
  };

  const handleSaveRename = async () => {
    if (!selectedJourneyId || !renameTitle.trim()) return;
    setRenaming(true);
    try {
      await renameJourneyFn({ data: { id: selectedJourneyId, newTitle: renameTitle.trim() } });
      setActiveJourneyDetails((prev: any) => ({ ...prev, route_description: renameTitle.trim() }));
      setJourneys((prev) =>
        prev.map((j) => (j.id === selectedJourneyId ? { ...j, route_description: renameTitle.trim() } : j)),
      );
      setRenameOpen(false);
      toast.success("Journey title updated!");
    } catch {
      toast.error("Failed to rename journey.");
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteJourney = async () => {
    if (!selectedJourneyId) return;
    setDeleting(true);
    try {
      await deleteJourneyFn({ data: { id: selectedJourneyId } });
      toast.success("Journey deleted.");
      setDeleteOpen(false);
      const remaining = journeys.filter((j) => j.id !== selectedJourneyId);
      setJourneys(remaining);
      if (remaining.length > 0) {
        handleSelectJourney(remaining[0].id);
      } else {
        setSelectedJourneyId(null);
        setActiveJourneyDetails(null);
        setStops([]);
      }
    } catch {
      toast.error("Failed to delete journey.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSimulateOrderStatus = async (orderId: string) => {
    try {
      const res = await advanceOrderFn({ data: { orderId } });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: res.newStatus } : o)),
      );
      toast.success(`Simulated order status: ${res.newStatus.replace("_", " ")}`);
    } catch {
      toast.error("Failed to advance order status.");
    }
  };

  const handleSimulateReservationStatus = async (reservationId: string) => {
    try {
      const res = await advanceReservationFn({ data: { reservationId } });
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, status: res.newStatus } : r)),
      );
      toast.success(`Simulated reservation status: ${res.newStatus.replace("_", " ")}`);
    } catch {
      toast.error("Failed to advance reservation status.");
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      const res = await savePrefsFn({
        data: {
          preferredMaxDetourKm: prefDetourKm,
          foodPreference: prefFood,
          alertDistanceKm: prefAlertDistance,
        },
      });
      setUserPreferences(res.preferences);
      toast.success(
        `Preferences saved: Max detour ${res.preferences.preferredMaxDetourKm} km, Food: ${res.preferences.foodPreference}, Alert: ${res.preferences.alertDistanceKm} km`,
      );
    } catch {
      toast.error("Failed to save preferences.");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Header & New Trip Action */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">My Journey</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your locked highway route, upcoming stops, advance orders, and trip preferences.
            </p>
          </div>
          <Button asChild size="lg" className="font-semibold shadow-xs">
            <Link to="/plan">
              <Plus className="size-4" /> Plan New Trip
            </Link>
          </Button>
        </div>

        {/* Loading Journeys Skeleton */}
        {loadingJourneys && (
          <div className="grid gap-6">
            <div className="h-64 animate-pulse rounded-2xl bg-muted" />
            <div className="h-48 animate-pulse rounded-2xl bg-muted" />
          </div>
        )}

        {/* Empty State: No Journeys Saved */}
        {!loadingJourneys && journeys.length === 0 && (
          <div className="rounded-3xl border border-dashed bg-card/50 p-12 text-center shadow-xs">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Compass className="size-8" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold">No saved journeys yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Plan your driving trip from Chandigarh to Jaipur (or any two locations) and lock in a route.
              RoadMate will calculate stops along your exact highway corridor.
            </p>
            <Button asChild size="lg" className="mt-6 font-semibold">
              <Link to="/plan">
                <Plus className="size-4" /> Plan Your First Trip
              </Link>
            </Button>
          </div>
        )}

        {/* Journeys Exist: Display Journey Dashboard */}
        {!loadingJourneys && journeys.length > 0 && (
          <div className="space-y-8">
            {/* Journey Management & Switcher Toolbar */}
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Select Trip:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {journeys.map((j) => {
                    const isActive = j.id === selectedJourneyId;
                    const originShort = j.origin_name.split(",")[0];
                    const destShort = j.destination_name.split(",")[0];
                    return (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => handleSelectJourney(j.id)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        {originShort} → {destShort}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeJourneyDetails && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    onClick={handleOpenRename}
                  >
                    <Edit2 className="size-3.5" /> Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              )}
            </div>

            {/* Active Journey Card & Interactive Route Map */}
            {activeJourneyDetails && (
              <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  {/* Left Column: Signboard Overview */}
                  <div className="flex flex-col justify-between p-6 lg:col-span-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" /> Locked Route
                        </span>
                        {activeJourneyDetails.route_description && (
                          <span className="nh-plate text-xs">
                            {activeJourneyDetails.route_description}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                            A
                          </span>
                          <span className="font-display text-base font-bold text-foreground">
                            {activeJourneyDetails.origin_name}
                          </span>
                        </div>
                        <div className="ml-2.5 h-4 w-0.5 border-l-2 border-dashed border-muted-foreground/40" />
                        <div className="flex items-start gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            B
                          </span>
                          <span className="font-display text-base font-bold text-foreground">
                            {activeJourneyDetails.destination_name}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-4 text-primary" />
                          {formatDuration(activeJourneyDetails.duration_seconds)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Gauge className="size-4 text-primary" />
                          {formatDistance(activeJourneyDetails.distance_meters)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-4 text-primary" />
                          {stops.length} upcoming stop{stops.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 border-t pt-4">
                      <Button asChild size="sm" variant="signal" className="w-full font-bold gap-1.5">
                        <Link
                          to="/journeys/$journeyId"
                          params={{ journeyId: activeJourneyDetails.id }}
                        >
                          Explore Corridor & Add Stops <ChevronRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Right Column: Route Map */}
                  <div className="h-72 border-t lg:col-span-7 lg:h-auto lg:border-t-0 lg:border-l">
                    <RouteMap
                      routes={activeRouteOptions}
                      selectedIndex={activeJourneyDetails.route_index ?? 0}
                      places={stopsAsPlaces}
                      selectedPlaceId={selectedPlaceId}
                      onSelectPlace={(p) => setSelectedPlaceId(p.id)}
                      carPosition={carPosition}
                      className="h-full min-h-[280px] w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Stage 6: Driving Simulation & Smart Notifications Panel */}
            {activeJourneyDetails && (
              <DrivingSimulationPanel
                journeyId={activeJourneyDetails.id}
                encodedPolyline={activeJourneyDetails.encoded_polyline}
                totalDistanceMeters={activeJourneyDetails.distance_meters}
                totalDurationSeconds={activeJourneyDetails.duration_seconds}
                stops={stops}
                userPreferences={userPreferences}
                onCarPositionChange={setCarPosition}
                onSelectStop={handleSelectStopFromSim}
              />
            )}

            {/* Upcoming Stops Section (Chronological Along Route) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <MapPin className="size-5 text-primary" /> Upcoming Stops ({stops.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Restaurants, petrol pumps, and hotels you've chosen in order along the route.
                  </p>
                </div>
                {activeJourneyDetails && (
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1">
                    <Link
                      to="/journeys/$journeyId"
                      params={{ journeyId: activeJourneyDetails.id }}
                    >
                      <Plus className="size-3.5" /> Add More Stops
                    </Link>
                  </Button>
                )}
              </div>

              {stops.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center text-muted-foreground">
                  <RouteIcon className="mx-auto mb-2 size-8 text-muted-foreground/60" />
                  <p className="text-sm font-semibold text-foreground">No stops added yet</p>
                  <p className="mt-1 text-xs">
                    Explore restaurants, petrol pumps, and hotels along your route and tap "+ Add Stop" to plan your breaks.
                  </p>
                  {activeJourneyDetails && (
                    <Button asChild size="sm" variant="outline" className="mt-4 font-semibold">
                      <Link
                        to="/journeys/$journeyId"
                        params={{ journeyId: activeJourneyDetails.id }}
                      >
                        Explore Stops Along Corridor
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  {stops.map((stop, idx) => {
                    const detourKm = (stop.detourMeters / 1000).toFixed(1);
                    const detourMin = Math.round(stop.detourSeconds / 60);

                    // Estimated arrival time calculation along highway
                    let etaText = "Calculating...";
                    if (activeJourneyDetails) {
                      const totalDist = activeJourneyDetails.distance_meters;
                      const totalSec = activeJourneyDetails.duration_seconds;
                      const fraction = totalDist > 0 ? Math.min(1, Math.max(0, stop.alongRouteM / totalDist)) : 0;
                      const travelSec = totalSec * fraction;
                      const etaDate = new Date(Date.now() + travelSec * 1000);
                      const timeStr = etaDate.toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      });
                      const hrs = Math.floor(travelSec / 3600);
                      const mins = Math.floor((travelSec % 3600) / 60);
                      const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                      etaText = `~${timeStr} (in ${durationStr})`;
                    }

                    // Check if an order or reservation exists for this stop
                    const linkedOrder = orders.find((o) => o.restaurantId === stop.placeId);
                    const linkedReservation = reservations.find((r) => r.restaurantId === stop.placeId);

                    return (
                      <div
                        key={stop.id}
                        id={`stop-card-${stop.placeId}`}
                        onClick={() => setSelectedPlaceId(stop.placeId)}
                        className={`group relative flex flex-col justify-between gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs sm:flex-row sm:items-center ${
                          selectedPlaceId === stop.placeId ? "border-primary ring-2 ring-primary/20" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* Chronological Stop Number Pill */}
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary">
                            #{idx + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-display text-base font-bold text-foreground">
                                {stop.name}
                              </h3>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                  stop.category === "restaurant" && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                                  stop.category === "fuel" && "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                                  stop.category === "hotel" && "bg-purple-500/15 text-purple-600 dark:text-purple-400",
                                )}
                              >
                                {stop.category === "restaurant"
                                  ? "Food Stop"
                                  : stop.category === "fuel"
                                    ? "Petrol Pump"
                                    : "Hotel / Stay"}
                              </span>
                            </div>

                            {/* Distance & Detour Stats */}
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                +{detourKm} km detour (~{detourMin} min)
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                <Clock className="size-3 text-primary" /> Est. Arrival: {etaText}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Navigation className="size-3" /> {formatDistance(stop.alongRouteM)} from start
                              </span>
                            </div>

                            {/* Honest Data Notes */}
                            <p className="mt-1.5 truncate text-xs text-muted-foreground">
                              {stop.address ? `📍 ${stop.address}` : "📍 Address: Not available"}
                              {stop.openingHours ? ` · 🕒 ${stop.openingHours}` : " · 🕒 Hours: Not available"}
                            </p>

                            {/* Linked Order or Reservation Indicator */}
                            {(linkedOrder || linkedReservation) && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {linkedOrder && (
                                  <span className="inline-flex items-center gap-1 rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                                    <UtensilsCrossed className="size-3" />
                                    Food Order: ₹{linkedOrder.totalAmount} · {linkedOrder.status.replace("_", " ")}
                                  </span>
                                )}
                                {linkedReservation && (
                                  <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                                    <Hotel className="size-3" />
                                    Table for {linkedReservation.guestCount} · {linkedReservation.status.replace("_", " ")}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                          {stop.category === "restaurant" && (
                            <Button
                              asChild
                              size="sm"
                              variant="signal"
                              className="h-8 text-xs font-bold gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                to="/restaurants/$restaurantId"
                                params={{ restaurantId: stop.placeId }}
                                search={{
                                  name: stop.name,
                                  address: stop.address ?? undefined,
                                  detourKm,
                                  detourMin: `${detourMin} min`,
                                  alongRouteM: String(stop.alongRouteM),
                                  journeyId: activeJourneyDetails?.id,
                                }}
                              >
                                <UtensilsCrossed className="size-3" /> Order / Reserve
                              </Link>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStop(stop.id, stop.name);
                            }}
                          >
                            <Trash2 className="size-3.5" /> Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Orders & Reservations Section */}
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <UtensilsCrossed className="size-5 text-orange-500" /> Orders & Reservation Requests
                </h2>
                <p className="text-xs text-muted-foreground">
                  Advance food orders and table reservations linked to stops on this journey.
                </p>
              </div>

              {/* Strict Disclaimer Banner */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <span className="font-bold">Prototype Notice:</span> All orders and reservations are demo requests.
                  Never confirmed by the actual restaurant in prototype mode. Use the simulation buttons below to test the status workflow.
                </div>
              </div>

              {journeyOrders.length === 0 && journeyReservations.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center text-muted-foreground text-xs">
                  No advance food orders or table reservations placed yet for this journey. Open any food stop above to place an order.
                </div>
              ) : (
                <div className="grid gap-3">
                  {/* Orders */}
                  {journeyOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border bg-card p-4 shadow-xs space-y-3"
                    >
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-base text-foreground">
                              {order.restaurantName}
                            </span>
                            <span className="rounded bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400">
                              Advance Food Order
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {order.restaurantAddress || "Corridor location"} · Est. Arrival:{" "}
                            {new Date(order.estimatedArrival).toLocaleTimeString("en-IN", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{order.totalAmount}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                      </div>

                      {/* Payment method badge */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-muted-foreground">Payment:</span>
                        {order.paymentMethod === "upi_at_table" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-medium">
                            <Smartphone className="size-3 text-emerald-500" /> UPI Pay at Table (after reaching)
                          </span>
                        ) : order.paymentMethod === "upi_advance" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-medium">
                            <Car className="size-3 text-sky-500" /> UPI Pre-paid (in car)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-medium">
                            <Banknote className="size-3 text-muted-foreground" /> Pay at Restaurant Counter
                          </span>
                        )}
                      </div>

                      {/* Items list */}
                      {order.items && order.items.length > 0 && (
                        <div className="rounded-lg bg-muted/60 p-2.5 text-xs">
                          <span className="font-bold text-muted-foreground">Items: </span>
                          <span className="text-foreground">
                            {order.items.map((item) => `${item.quantity}x ${item.name} (₹${item.price * item.quantity})`).join(", ")}
                          </span>
                        </div>
                      )}

                      {/* Status Simulation Action */}
                      <div className="flex flex-col justify-between gap-2 border-t pt-2.5 sm:flex-row sm:items-center">
                        <span className="text-[11px] italic text-muted-foreground">
                          Prototype: not confirmed by the restaurant
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-semibold gap-1.5 hover:border-primary"
                          onClick={() => handleSimulateOrderStatus(order.id)}
                        >
                          <RotateCcw className="size-3 text-primary" /> Simulate restaurant response
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Reservations */}
                  {journeyReservations.map((res) => (
                    <div
                      key={res.id}
                      className="rounded-xl border bg-card p-4 shadow-xs space-y-3"
                    >
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-base text-foreground">
                              {res.restaurantName}
                            </span>
                            <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">
                              Table Reservation
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Table for {res.guestCount} guests · Arrival:{" "}
                            {new Date(res.arrivalTime).toLocaleTimeString("en-IN", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </p>
                        </div>
                        <div>{getStatusBadge(res.status)}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-3" /> {res.customerName}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" /> {res.customerPhone}
                        </span>
                      </div>

                      {/* Status Simulation Action */}
                      <div className="flex flex-col justify-between gap-2 border-t pt-2.5 sm:flex-row sm:items-center">
                        <span className="text-[11px] italic text-muted-foreground">
                          Prototype: not confirmed by the restaurant
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-semibold gap-1.5 hover:border-primary"
                          onClick={() => handleSimulateReservationStatus(res.id)}
                        >
                          <RotateCcw className="size-3 text-primary" /> Simulate restaurant response
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preferences Section: Persistent Defaults */}
            <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <SlidersHorizontal className="size-5 text-primary" /> Trip & Corridor Preferences
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Preferences are saved in persistent storage and automatically applied as defaults when discovering places along any route.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="font-bold"
                  disabled={savingPrefs}
                  onClick={handleSavePreferences}
                >
                  {savingPrefs ? "Saving..." : "Save Preferences"}
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {/* 1. Preferred Maximum Detour Distance */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Max Detour Limit
                    </label>
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-display text-xs font-bold text-primary">
                      {prefDetourKm} km
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.5}
                    value={prefDetourKm}
                    onChange={(e) => setPrefDetourKm(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1 km (quickest)</span>
                    <span>5 km</span>
                    <span>10 km (widest)</span>
                  </div>
                </div>

                {/* 2. Food Preference */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Food Preference
                  </label>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setPrefFood("any")}
                      className={cn(
                        "rounded py-1.5 text-xs font-semibold transition-all",
                        prefFood === "any"
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      All Food
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrefFood("veg")}
                      className={cn(
                        "rounded py-1.5 text-xs font-semibold transition-all",
                        prefFood === "veg"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Veg Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrefFood("non-veg")}
                      className={cn(
                        "rounded py-1.5 text-xs font-semibold transition-all",
                        prefFood === "non-veg"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Non-Veg
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Defaults menus and discovery filters to your diet choice.
                  </p>
                </div>

                {/* 3. Alert Distance */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Stop Alert Distance
                  </label>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                    {[2, 5, 10].map((dist) => (
                      <button
                        key={dist}
                        type="button"
                        onClick={() => setPrefAlertDistance(dist)}
                        className={cn(
                          "rounded py-1.5 text-xs font-semibold transition-all",
                          prefAlertDistance === dist
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {dist} km
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Notifies you {prefAlertDistance} km before approaching your stop.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Rename Journey Dialog Modal */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Trip</DialogTitle>
            <DialogDescription>
              Give this journey a custom name (e.g., "Chandigarh to Jaipur Weekend Run").
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder="e.g. NH 48 Jaipur Road Trip"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRename} disabled={renaming || !renameTitle.trim()}>
              {renaming ? "Saving..." : "Save Title"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Journey Confirmation Dialog Modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Journey?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this trip? All attached upcoming stops and itinerary details will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteJourney} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Journey"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
