import type { DbJourneyStop } from "./orders-db.server";

export type SimulatedAlert = {
  id: string;
  stopId: string;
  placeId: string;
  stopName: string;
  category: "restaurant" | "fuel" | "hotel";
  alongRouteM: number;
  thresholdKm: number;
  remainingMeters: number;
  estimatedMinutes: number;
  title: string;
  message: string;
  simulatedKm: number;
  simulatedTimeStr: string;
  timestamp: string;
};

export const DEFAULT_ALERT_THRESHOLDS_KM = [10, 5, 1];

/**
 * Checks for distance and arrival alerts based on current simulated car position.
 * Returns newly triggered alerts that haven't been triggered yet.
 * Never alters the route; only computes alerts based on remaining distance.
 */
export function checkDistanceAlerts(params: {
  currentMeters: number;
  stops: DbJourneyStop[];
  thresholdsKm: number[]; // e.g. [10, 5, 1]
  triggeredKeys: Set<string>;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}): { newAlerts: SimulatedAlert[]; nextTriggeredKeys: Set<string> } {
  const {
    currentMeters,
    stops,
    thresholdsKm,
    triggeredKeys,
    totalDistanceMeters,
    totalDurationSeconds,
  } = params;

  const nextTriggeredKeys = new Set(triggeredKeys);
  const newAlerts: SimulatedAlert[] = [];

  // Average cruising speed in m/s (default ~60 km/h = 16.67 m/s if route data empty)
  const speedMps =
    totalDistanceMeters > 0 && totalDurationSeconds > 0
      ? totalDistanceMeters / totalDurationSeconds
      : (60 * 1000) / 3600;

  // Sort stops chronologically along route
  const sortedStops = [...stops].sort((a, b) => a.alongRouteM - b.alongRouteM);

  // Sort thresholds descending: e.g. 10, 5, 1
  const sortedThresholds = [...thresholdsKm].sort((a, b) => b - a);

  for (const stop of sortedStops) {
    // Only check stops that are ahead of the current car position
    if (stop.alongRouteM > currentMeters) {
      const remainingMeters = stop.alongRouteM - currentMeters;
      const remainingKm = remainingMeters / 1000;

      for (const thresholdKm of sortedThresholds) {
        const thresholdMeters = thresholdKm * 1000;
        const alertKey = `${stop.id}-${thresholdKm}km`;

        // If car has come within this threshold distance and alert hasn't fired yet
        if (remainingMeters <= thresholdMeters && !nextTriggeredKeys.has(alertKey)) {
          nextTriggeredKeys.add(alertKey);

          // Calculate estimated travel time to this stop
          const estSeconds = Math.max(60, Math.round(remainingMeters / speedMps));
          const estMinutes = Math.max(1, Math.round(estSeconds / 60));

          const title = `${stop.name} is ${thresholdKm} km ahead`;
          const message = `Arriving at ${stop.name} in about ${estMinutes} minute${
            estMinutes === 1 ? "" : "s"
          } (${remainingKm.toFixed(1)} km remaining along your route).`;

          newAlerts.push({
            id: `alert-${stop.id}-${thresholdKm}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            stopId: stop.id,
            placeId: stop.placeId,
            stopName: stop.name,
            category: stop.category,
            alongRouteM: stop.alongRouteM,
            thresholdKm,
            remainingMeters,
            estimatedMinutes: estMinutes,
            title,
            message,
            simulatedKm: Number((currentMeters / 1000).toFixed(1)),
            simulatedTimeStr: new Date().toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  return { newAlerts, nextTriggeredKeys };
}
