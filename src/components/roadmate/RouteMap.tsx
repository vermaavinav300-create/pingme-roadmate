import { useEffect, useRef, useState } from "react";
import { MapPinOff } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { mapStyles, mapTheme } from "@/lib/map-theme";
import { decodePolyline, type RouteOption } from "@/lib/route-utils";

type Props = {
  routes: RouteOption[];
  selectedIndex: number | null;
  onSelect?: (index: number) => void;
  className?: string;
};

const INDIA_CENTER = { lat: 22.5, lng: 79 };

export function RouteMap({ routes, selectedIndex, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Array<google.maps.Polyline | google.maps.Marker>>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: INDIA_CENTER,
          zoom: 5,
          clickableIcons: false,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          gestureHandling: "greedy",
          styles: mapStyles,
        });
        setStatus("ready");
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fit the view whenever a new set of routes arrives (not on selection changes).
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || routes.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    routes.forEach((r) => decodePolyline(r.encodedPolyline).forEach((p) => bounds.extend(p)));
    map.fitBounds(bounds, 48);
  }, [status, routes]);

  // Draw routes: alternatives in grey, the selected one in signboard green on top.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    const ordered = [...routes].sort(
      (a, b) => Number(a.index === selectedIndex) - Number(b.index === selectedIndex),
    );
    ordered.forEach((route) => {
      const path = decodePolyline(route.encodedPolyline);
      const isSelected = route.index === selectedIndex;
      if (isSelected) {
        overlaysRef.current.push(
          new google.maps.Polyline({
            map,
            path,
            strokeColor: mapTheme.selectedCasing,
            strokeWeight: 10,
            strokeOpacity: 1,
            zIndex: 3,
          }),
        );
      }
      const line = new google.maps.Polyline({
        map,
        path,
        strokeColor: isSelected ? mapTheme.selected : mapTheme.alternative,
        strokeWeight: isSelected ? 6 : 5,
        strokeOpacity: isSelected ? 1 : 0.75,
        zIndex: isSelected ? 4 : 1,
        clickable: !!onSelectRef.current,
      });
      line.addListener("click", () => onSelectRef.current?.(route.index));
      overlaysRef.current.push(line);
    });

    const first = routes[0];
    if (first) {
      const pin = (position: google.maps.LatLngLiteral, label: string, color: string) =>
        new google.maps.Marker({
          map,
          position,
          zIndex: 10,
          label: { text: label, color: "#ffffff", fontWeight: "700", fontSize: "12px" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: mapTheme.markerStroke,
            strokeWeight: 3,
          },
        });
      overlaysRef.current.push(pin(first.start, "A", mapTheme.origin));
      overlaysRef.current.push(pin(first.end, "B", mapTheme.destination));
    }
  }, [status, routes, selectedIndex]);

  return (
    <div className={`relative overflow-hidden bg-muted ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-asphalt">
            <div className="road-dashes h-full w-full" />
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
          <MapPinOff className="size-8" />
          <p className="text-sm font-medium">The map can't load on this address.</p>
          <p className="max-w-xs text-xs">
            Routes are still listed. Open the app from its lovable.app link to see the map.
          </p>
        </div>
      )}
    </div>
  );
}
