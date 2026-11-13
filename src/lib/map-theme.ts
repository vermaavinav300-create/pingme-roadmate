// Google Maps draws polylines/markers with plain CSS colours, not CSS variables.
// These mirror the design tokens in src/styles.css (primary green, signal amber, asphalt).
export const mapTheme = {
  selected: "#1f6b4a",
  selectedCasing: "#0f3d2a",
  alternative: "#8a958f",
  origin: "#1f6b4a",
  destination: "#e0a81c",
  markerStroke: "#ffffff",
};

export const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f2d48a" }] },
  { featureType: "water", stylers: [{ color: "#bcd8d4" }] },
  { featureType: "landscape", stylers: [{ color: "#f3efe4" }] },
];
