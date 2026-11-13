import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RotateCcw,
  Navigation,
  BellRing,
  UtensilsCrossed,
  Fuel,
  Hotel,
  ChevronRight,
  Eye,
  X,
  Clock,
  Gauge,
  MapPin,
  Sparkles,
  AlertCircle,
  Info,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  decodePolyline,
  formatDistance,
  formatDuration,
  getPointAlongPolyline,
  type LatLng,
} from "@/lib/route-utils";
import type { DbJourneyStop, UserPreferences } from "@/lib/orders-db.server";
import {
  checkDistanceAlerts,
  DEFAULT_ALERT_THRESHOLDS_KM,
  type SimulatedAlert,
} from "@/lib/simulation-utils";

type Props = {
  journeyId: string;
  encodedPolyline: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  stops: DbJourneyStop[];
  userPreferences?: UserPreferences | null;
  onCarPositionChange: (pos: LatLng | null) => void;
  onSelectStop: (stopPlaceId: string) => void;
  className?: string;
};

export function DrivingSimulationPanel({
  journeyId,
  encodedPolyline,
  totalDistanceMeters,
  totalDurationSeconds,
  stops,
  userPreferences,
  onCarPositionChange,
  onSelectStop,
  className,
}: Props) {
  // Decode polyline points
  const points = useMemo(() => {
    if (!encodedPolyline) return [];
    return decodePolyline(encodedPolyline);
  }, [encodedPolyline]);

  // Simulation playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 5 | 10>(5);
  const [currentMeters, setCurrentMeters] = useState(0);

  // Alert thresholds: default [10, 5, 1] + user preference if set
  const alertThresholds = useMemo(() => {
    const list = [...DEFAULT_ALERT_THRESHOLDS_KM];
    if (userPreferences?.alertDistanceKm && !list.includes(userPreferences.alertDistanceKm)) {
      list.push(userPreferences.alertDistanceKm);
    }
    return list.sort((a, b) => b - a);
  }, [userPreferences?.alertDistanceKm]);

  // Alert tracking state
  const [triggeredKeys, setTriggeredKeys] = useState<Set<string>>(new Set());
  const [activeAlert, setActiveAlert] = useState<SimulatedAlert | null>(null);
  const [alertHistory, setAlertHistory] = useState<SimulatedAlert[]>([]);

  // Update car position whenever currentMeters or points changes
  useEffect(() => {
    if (points.length === 0) {
      onCarPositionChange(null);
      return;
    }
    const pos = getPointAlongPolyline(points, currentMeters);
    onCarPositionChange(pos);
  }, [points, currentMeters, onCarPositionChange]);

  // Check for alerts whenever currentMeters updates
  const evaluateAlertsAtDistance = (meters: number) => {
    if (stops.length === 0) return;

    const { newAlerts, nextTriggeredKeys } = checkDistanceAlerts({
      currentMeters: meters,
      stops,
      thresholdsKm: alertThresholds,
      triggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });

    if (newAlerts.length > 0) {
      setTriggeredKeys(nextTriggeredKeys);
      setAlertHistory((prev) => [...newAlerts, ...prev]);
      // Show the most critical (nearest) alert as active
      setActiveAlert(newAlerts[0]);

      // Pop in-app toast notification
      for (const alert of newAlerts) {
        toast.info(alert.title, {
          description: alert.message,
          icon: <BellRing className="size-4 text-primary" />,
          duration: 5000,
        });
      }
    }
  };

  // Playback Animation Loop
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    // Base speed: route speed or default 80 km/h (22.2 m/s)
    const baseSpeedMps =
      totalDistanceMeters > 0 && totalDurationSeconds > 0
        ? (totalDistanceMeters / totalDurationSeconds)
        : (80 * 1000) / 3600;

    const animate = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const deltaSeconds = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Advance simulated distance smoothly
      // In 1x, advance at realistic speed * demo scale factor (e.g. 5x base so users don't wait 8 hours)
      // Speed multiplier controls 1x, 5x, 10x
      const step = baseSpeedMps * deltaSeconds * speedMultiplier * 15;

      setCurrentMeters((prev) => {
        const next = Math.min(totalDistanceMeters, prev + step);
        evaluateAlertsAtDistance(next);

        if (next >= totalDistanceMeters) {
          setIsPlaying(false);
          toast.success("Destination reached! Simulation completed.");
          return totalDistanceMeters;
        }
        return next;
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, speedMultiplier, totalDistanceMeters, totalDurationSeconds, stops, alertThresholds, triggeredKeys]);

  // Slider change handler (scrubbing along the route)
  const handleSliderChange = (meters: number) => {
    setCurrentMeters(meters);
    evaluateAlertsAtDistance(meters);
  };

  // Reset simulation handler
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentMeters(0);
    setTriggeredKeys(new Set());
    setActiveAlert(null);
    onCarPositionChange(points.length > 0 ? points[0] : null);
    toast.info("Simulation reset to start point (0 km).");
  };

  // Clear alert history handler
  const handleClearHistory = () => {
    setAlertHistory([]);
    setActiveAlert(null);
    toast.info("Alert history cleared.");
  };

  const progressPercent = totalDistanceMeters > 0
    ? Math.min(100, Math.round((currentMeters / totalDistanceMeters) * 100))
    : 0;

  const simulatedSpeedKmH = Math.round(
    (totalDistanceMeters > 0 && totalDurationSeconds > 0
      ? (totalDistanceMeters / totalDurationSeconds) * 3.6
      : 75) * speedMultiplier,
  );

  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-xs space-y-5", className)}>
      {/* Header & Strict Honesty Banner */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold flex items-center gap-2 text-foreground">
              <Navigation className="size-5 text-primary" /> Simulate Driving & Smart Alerts
            </h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              Stage 6
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Test real-time highway distance and arrival alerts by driving a simulated car along your route.
          </p>
        </div>

        {/* Mandatory Transparency Disclaimer (Requirement 7 & 6) */}
        <div className="rounded-lg bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 border">
          <Info className="size-3.5 text-primary shrink-0" />
          <span>Simulated journey (demo). Real GPS alerts would come in a later version.</span>
        </div>
      </div>

      {/* Active High-Priority Alert Banner (Requirement 2, 3, 4) */}
      {activeAlert && (
        <div className="relative overflow-hidden rounded-xl border-2 border-primary/40 bg-primary/5 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs",
                  activeAlert.category === "restaurant" && "bg-orange-500 text-white",
                  activeAlert.category === "fuel" && "bg-sky-500 text-white",
                  activeAlert.category === "hotel" && "bg-purple-500 text-white",
                )}
              >
                {activeAlert.category === "restaurant" ? (
                  <UtensilsCrossed className="size-5" />
                ) : activeAlert.category === "fuel" ? (
                  <Fuel className="size-5" />
                ) : (
                  <Hotel className="size-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-bold text-foreground">
                    {activeAlert.title}
                  </span>
                  <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {activeAlert.thresholdKm} km alert
                  </span>
                </div>

                <p className="mt-1 text-xs text-foreground/90 font-medium leading-relaxed">
                  {activeAlert.message}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>🚗 Car at: {activeAlert.simulatedKm} km</span>
                  <span>•</span>
                  <span>🕒 Triggered at {activeAlert.simulatedTimeStr}</span>
                </div>
              </div>
            </div>

            {/* Dismiss Button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setActiveAlert(null)}
              aria-label="Dismiss alert"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Alert Actions: View Stop, Place Order, Dismiss (Requirement 4) */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold gap-1.5"
              onClick={() => onSelectStop(activeAlert.placeId)}
            >
              <Eye className="size-3.5" /> View Stop on Map
            </Button>

            {activeAlert.category === "restaurant" && (
              <Button
                asChild
                size="sm"
                variant="signal"
                className="h-8 text-xs font-bold gap-1.5"
              >
                <Link
                  to="/restaurants/$restaurantId"
                  params={{ restaurantId: activeAlert.placeId }}
                  search={{
                    name: activeAlert.stopName,
                    journeyId,
                    detourKm: "On route",
                    alongRouteM: String(activeAlert.alongRouteM),
                  }}
                >
                  <UtensilsCrossed className="size-3.5" /> Place Food Order / Reserve
                </Link>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setActiveAlert(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Driving Controls Toolbar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
        {/* Play/Pause & Reset */}
        <div className="flex flex-wrap items-center gap-2 lg:col-span-5">
          <Button
            type="button"
            size="sm"
            variant={isPlaying ? "secondary" : "default"}
            className="font-bold gap-1.5 h-9"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <>
                <Pause className="size-4" /> Pause Driving
              </>
            ) : (
              <>
                <Play className="size-4 fill-current" /> Start Simulation
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 h-9 text-xs font-semibold"
            onClick={handleReset}
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>

          {/* Speed Multiplier Controls (1x, 5x, 10x) */}
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            {([1, 5, 10] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeedMultiplier(spd)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold transition-all",
                  speedMultiplier === spd
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Live Simulation Stats */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground lg:col-span-7 lg:justify-end">
          <span className="flex items-center gap-1.5">
            <Gauge className="size-4 text-primary" />
            Simulated Speed: <strong className="text-foreground">{simulatedSpeedKmH} km/h</strong>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4 text-primary" />
            Position: <strong className="text-foreground">{formatDistance(currentMeters)}</strong> / {formatDistance(totalDistanceMeters)}
          </span>
          <span>•</span>
          <span className="rounded bg-secondary px-2 py-0.5 font-bold text-secondary-foreground">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Interactive Route Scrubber / Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>Start: 0 km</span>
          <span className="text-foreground font-bold">
            🚗 Car at {(currentMeters / 1000).toFixed(1)} km
          </span>
          <span>Destination: {(totalDistanceMeters / 1000).toFixed(0)} km</span>
        </div>

        <input
          type="range"
          min={0}
          max={totalDistanceMeters || 1000}
          step={500}
          value={currentMeters}
          onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
          className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
        />

        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Drag slider to fast-forward or jump to any kilometer along the highway</span>
          <span>Alerts fire at {alertThresholds.map((t) => `${t} km`).join(", ")} before stops</span>
        </div>
      </div>

      {/* Alert History Section (Requirement 5) */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-sm font-bold flex items-center gap-1.5 text-foreground">
            <BellRing className="size-4 text-primary" />
            Alert History ({alertHistory.length})
          </h4>
          {alertHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleClearHistory}
            >
              <Trash2 className="size-3" /> Clear History
            </Button>
          )}
        </div>

        {alertHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
            No alerts triggered yet. Press <strong>Start Simulation</strong> or drag the scrubber above to approach stops along your route.
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {alertHistory.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col justify-between gap-2 rounded-xl border bg-muted/40 p-3 transition hover:bg-muted/70 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      alert.category === "restaurant" && "bg-orange-500",
                      alert.category === "fuel" && "bg-sky-500",
                      alert.category === "hotel" && "bg-purple-500",
                    )}
                  >
                    {alert.category === "restaurant" ? "🍽️" : alert.category === "fuel" ? "⛽" : "🏨"}
                  </span>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="truncate font-semibold text-foreground">{alert.title}</strong>
                      <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                        {alert.thresholdKm} km
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground truncate">{alert.message}</p>
                    <span className="text-[10px] text-muted-foreground/75">
                      Triggered at car position {alert.simulatedKm} km · {alert.simulatedTimeStr}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] font-semibold"
                    onClick={() => onSelectStop(alert.placeId)}
                  >
                    <Eye className="size-3" /> View
                  </Button>
                  {alert.category === "restaurant" && (
                    <Button
                      asChild
                      size="sm"
                      variant="signal"
                      className="h-7 px-2 text-[11px] font-bold"
                    >
                      <Link
                        to="/restaurants/$restaurantId"
                        params={{ restaurantId: alert.placeId }}
                        search={{
                          name: alert.stopName,
                          journeyId,
                          detourKm: "On route",
                          alongRouteM: String(alert.alongRouteM),
                        }}
                      >
                        Order
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
