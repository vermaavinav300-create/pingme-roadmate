import { useState, useMemo } from "react";
import { UtensilsCrossed, Fuel, Hotel, Clock, Navigation, MapPin, SlidersHorizontal, AlertCircle, Phone, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filterPlaces, estimateDetour, type RoutePlace, type PlaceCategory } from "@/lib/places-utils";
import { formatDistance, formatDuration } from "@/lib/route-utils";

type Props = {
  places: RoutePlace[];
  loading: boolean;
  selectedPlaceId?: string | null;
  onSelectPlace: (place: RoutePlace) => void;
  maxDetourKm: number;
  onMaxDetourChange: (km: number) => void;
};

export function RoutePlacesDiscovery({
  places,
  loading,
  selectedPlaceId,
  onSelectPlace,
  maxDetourKm,
  onMaxDetourChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<PlaceCategory>("restaurant");

  // Filter places based on active category and maximum detour limit
  const filteredPlaces = useMemo(() => {
    return filterPlaces(places, {
      category: activeTab,
      maxDetourKm,
      sort: "nearest",
    });
  }, [places, activeTab, maxDetourKm]);

  // Counts for each category tab within the current max detour
  const counts = useMemo(() => {
    return {
      restaurant: places.filter((p) => p.category === "restaurant" && estimateDetour(p.distanceFromRouteM).meters <= maxDetourKm * 1000).length,
      fuel: places.filter((p) => p.category === "fuel" && estimateDetour(p.distanceFromRouteM).meters <= maxDetourKm * 1000).length,
      hotel: places.filter((p) => p.category === "hotel" && estimateDetour(p.distanceFromRouteM).meters <= maxDetourKm * 1000).length,
    };
  }, [places, maxDetourKm]);

  return (
    <div className="flex flex-col gap-4">
      {/* Maximum Detour Slider Control */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="detour-slider" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <SlidersHorizontal className="size-3.5 text-primary" /> Max detour allowed
          </label>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-display text-sm font-bold text-primary">
            {maxDetourKm} km
          </span>
        </div>

        <input
          id="detour-slider"
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={maxDetourKm}
          onChange={(e) => onMaxDetourChange(parseFloat(e.target.value))}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
        />

        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>1 km (quickest)</span>
          <span>Adds up to ~{Math.round((maxDetourKm * 2 / 40) * 60)} min</span>
          <span>10 km (wider range)</span>
        </div>
      </div>

      {/* Category Tabs: Food, Fuel, Stays */}
      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setActiveTab("restaurant")}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-all ${
            activeTab === "restaurant" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UtensilsCrossed className="size-3.5 text-orange-500" />
          <span>Food</span>
          <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-bold">
            {counts.restaurant}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fuel")}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-all ${
            activeTab === "fuel" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Fuel className="size-3.5 text-sky-500" />
          <span>Fuel</span>
          <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-bold">
            {counts.fuel}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("hotel")}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-all ${
            activeTab === "hotel" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Hotel className="size-3.5 text-purple-500" />
          <span>Stays</span>
          <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-bold">
            {counts.hotel}
          </span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium">Scanning OpenStreetMap along your driving route...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredPlaces.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          <Info className="mx-auto mb-2 size-6 text-muted-foreground/60" />
          <p className="text-sm font-semibold">No {activeTab}s found within {maxDetourKm} km detour</p>
          <p className="mt-1 text-xs">
            Try increasing the maximum detour slider above to broaden your search radius.
          </p>
        </div>
      )}

      {/* Places List Cards */}
      {!loading && filteredPlaces.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {filteredPlaces.map((place) => {
            const isSelected = place.id === selectedPlaceId;
            const detour = estimateDetour(place.distanceFromRouteM);
            const detourKm = (detour.meters / 1000).toFixed(1);
            const detourMin = Math.round(detour.seconds / 60);

            return (
              <div
                key={place.id}
                onClick={() => onSelectPlace(place)}
                className={`group cursor-pointer rounded-xl border p-3.5 transition-all hover:border-primary/50 hover:bg-accent/40 ${
                  isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs" : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate font-semibold text-sm">
                        {place.name || `Unnamed ${place.kind.replace("_", " ")}`}
                      </h4>
                      <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium capitalize text-secondary-foreground">
                        {place.kind.replace("_", " ")}
                      </span>
                    </div>

                    {/* Detour Distance & Time Banner */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +{detourKm} km detour ({detourMin} min)
                      </span>
                      <span className="text-muted-foreground/60">•</span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Navigation className="size-3" /> {formatDistance(place.alongRouteM)} from start
                      </span>
                    </div>

                    {/* Address if available */}
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {place.address ? `📍 ${place.address}` : "📍 Address: Not available"}
                    </p>

                    {/* Verified Hours & Contact */}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {place.openingHours ? place.openingHours : "Hours: Not available"}
                      </span>
                      {place.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" /> {place.phone}
                        </span>
                      ) : (
                        <span>Phone: Not available</span>
                      )}
                    </div>

                    {/* Zero-Fabrication Transparency Rule Notice */}
                    <div className="mt-2 border-t pt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/75">
                      <span>⭐ Rating: <em className="not-italic text-muted-foreground font-medium">Not available</em></span>
                      <span>📷 Photos: <em className="not-italic text-muted-foreground font-medium">Not available</em></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
