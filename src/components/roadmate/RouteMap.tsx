import { useEffect, useRef, useState } from "react";
import { decodePolyline, type LatLng, type RouteOption } from "@/lib/route-utils";
import type { RoutePlace } from "@/lib/places-utils";
import { estimateDetour } from "@/lib/places-utils";

type Props = {
  routes: RouteOption[];
  selectedIndex: number | null;
  onSelect?: (index: number) => void;
  places?: RoutePlace[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: RoutePlace) => void;
  className?: string;
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  restaurant: { bg: "#ea580c", border: "#c2410c", icon: "🍽️" },
  fuel: { bg: "#0284c7", border: "#0369a1", icon: "⛽" },
  hotel: { bg: "#7c3aed", border: "#6d28d9", icon: "🏨" },
};

export function RouteMap({
  routes,
  selectedIndex,
  onSelect,
  places = [],
  selectedPlaceId,
  onSelectPlace,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersGroupRef = useRef<any>(null);
  const placesGroupRef = useRef<any>(null);
  const markersByIdRef = useRef<Map<string, any>>(new Map());
  const [ready, setReady] = useState(false);

  // Initialize Leaflet Map (client-side only)
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapInstanceRef.current) return;
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [28.6139, 77.209], // Default India
        zoom: 6,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      layersGroupRef.current = L.layerGroup().addTo(map);
      placesGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Draw Driving Routes & Start/End Markers
  useEffect(() => {
    if (!ready || !mapInstanceRef.current || !layersGroupRef.current) return;
    const map = mapInstanceRef.current;
    const layers = layersGroupRef.current;
    layers.clearLayers();

    if (routes.length === 0) return;

    import("leaflet").then((L) => {
      let mainBounds: any = null;

      // Draw alternative routes first, selected route on top
      const ordered = [...routes].sort(
        (a, b) => Number(a.index === selectedIndex) - Number(b.index === selectedIndex),
      );

      ordered.forEach((r) => {
        const isSelected = r.index === selectedIndex;
        const latLngs = decodePolyline(r.encodedPolyline).map((p) => [p.lat, p.lng] as [number, number]);

        if (latLngs.length === 0) return;

        if (isSelected) {
          // Highway casing (dark green)
          const casing = L.polyline(latLngs, {
            color: "#064e3b",
            weight: 9,
            opacity: 0.9,
          });
          layers.addLayer(casing);

          // Route core line (vibrant emerald green)
          const polyline = L.polyline(latLngs, {
            color: "#10b981",
            weight: 5,
            opacity: 1,
          });
          layers.addLayer(polyline);
          mainBounds = polyline.getBounds();
        } else {
          // Alternative routes in subdued slate grey
          const polyline = L.polyline(latLngs, {
            color: "#94a3b8",
            weight: 4,
            opacity: 0.7,
            dashArray: "6, 8",
          });
          if (onSelect) {
            polyline.on("click", () => onSelect(r.index));
          }
          layers.addLayer(polyline);
        }
      });

      // Add Origin (A) and Destination (B) Pin Markers
      const selected = routes.find((r) => r.index === selectedIndex) ?? routes[0];
      if (selected) {
        const createEndpointIcon = (label: string, color: string) =>
          L.divIcon({
            className: "roadmate-endpoint-pin",
            html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 13px; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.35);">${label}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

        const startMarker = L.marker([selected.start.lat, selected.start.lng], {
          icon: createEndpointIcon("A", "#059669"),
          zIndexOffset: 1000,
        }).bindPopup("<b>Starting Point</b>");

        const endMarker = L.marker([selected.end.lat, selected.end.lng], {
          icon: createEndpointIcon("B", "#dc2626"),
          zIndexOffset: 1000,
        }).bindPopup("<b>Destination</b>");

        layers.addLayer(startMarker);
        layers.addLayer(endMarker);
      }

      if (mainBounds && mainBounds.isValid()) {
        map.fitBounds(mainBounds, { padding: [30, 30] });
      }
    });
  }, [ready, routes, selectedIndex, onSelect]);

  // Draw Stage 2 Places Markers along the route
  useEffect(() => {
    if (!ready || !placesGroupRef.current) return;
    const placesLayer = placesGroupRef.current;
    placesLayer.clearLayers();
    markersByIdRef.current.clear();

    if (places.length === 0) return;

    import("leaflet").then((L) => {
      places.forEach((place) => {
        const config = CATEGORY_COLORS[place.category] ?? { bg: "#475569", border: "#334155", icon: "📍" };
        const isFocused = place.id === selectedPlaceId;
        const detour = estimateDetour(place.distanceFromRouteM);
        const detourKm = (detour.meters / 1000).toFixed(1);
        const detourMin = Math.round(detour.seconds / 60);

        const iconHtml = `
          <div style="background-color: ${config.bg}; width: ${isFocused ? 32 : 26}px; height: ${isFocused ? 32 : 26}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${isFocused ? 15 : 12}px; border: 2.5px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); transition: transform 0.2s;">
            ${config.icon}
          </div>
        `;

        const icon = L.divIcon({
          className: "roadmate-place-marker",
          html: iconHtml,
          iconSize: [isFocused ? 32 : 26, isFocused ? 32 : 26],
          iconAnchor: [isFocused ? 16 : 13, isFocused ? 16 : 13],
        });

        const marker = L.marker([place.lat, place.lng], {
          icon,
          zIndexOffset: isFocused ? 800 : 500,
        });

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; min-width: 170px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">${place.name || "Unnamed " + place.kind}</div>
            <div style="display: inline-block; padding: 2px 6px; background-color: #f1f5f9; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: capitalize; margin-bottom: 6px;">
              ${place.kind.replace("_", " ")}
            </div>
            <div style="color: #059669; font-weight: 600; margin-bottom: 4px;">
              +${detourKm} km detour (${detourMin} min)
            </div>
            ${place.address ? `<div style="color: #64748b; font-size: 12px; margin-bottom: 2px;">📍 ${place.address}</div>` : ""}
            ${place.openingHours ? `<div style="color: #64748b; font-size: 12px; margin-bottom: 2px;">🕒 ${place.openingHours}</div>` : `<div style="color: #94a3b8; font-size: 11px;">🕒 Hours: Not available</div>`}
            <div style="color: #94a3b8; font-size: 11px; margin-top: 4px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
              ⭐ Ratings: Not available | 📷 Photos: Not available
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        if (onSelectPlace) {
          marker.on("click", () => onSelectPlace(place));
        }

        placesLayer.addLayer(marker);
        markersByIdRef.current.set(place.id, marker);
      });
    });
  }, [ready, places, selectedPlaceId, onSelectPlace]);

  // Center on selected place when requested
  useEffect(() => {
    if (!selectedPlaceId || !mapInstanceRef.current) return;
    const marker = markersByIdRef.current.get(selectedPlaceId);
    if (marker) {
      marker.openPopup();
      mapInstanceRef.current.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
    }
  }, [selectedPlaceId]);

  return (
    <div className={`relative overflow-hidden bg-muted ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="text-center">
            <div className="mx-auto size-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
            <p className="text-xs text-muted-foreground font-medium">Loading interactive map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
