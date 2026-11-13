# PingME RoadMate — Architecture

## What it is
A road-trip companion (a service inside the PingME super app) that shows food, fuel and stays
**along the exact route the traveller picks** — never random nearby places or other routes.

## Building blocks
| Layer | What we use | Why |
|---|---|---|
| Web app | TanStack Start (React) | Pages + secure server functions in one project |
| Map display | Google Maps JavaScript API (browser key, domain-restricted) | Interactive route map |
| Routes | Google Routes API (server-side) | Real driving routes + alternatives |
| Places | Google Places API (New) (server-side) | Autocomplete, restaurants, pumps, hotels along route |
| Database + sign-in | Lovable Cloud | Journeys, orders, bookings, preferences, accounts |
| Notifications | Browser notifications + geolocation (stage 6) | Distance / ETA alerts |

All Google calls that need a secret run on the server through Lovable's connector gateway.
The browser only gets the domain-restricted map key.

## Credentials
| Credential | Status |
|---|---|
| Google Maps Platform | Connected (Managed by Lovable) — no key needed from the team |
| Lovable Cloud (database + auth) | Enabled — no key needed |
| Restaurant / hotel partner APIs | **Not available** — orders and bookings are stored as *requests* and labelled "Unconfirmed" |
| PingME production backend | **Not used** — vehicle QR is a labelled concept; journey QR links to RoadMate itself |

## Data (tables)
- `profiles` — name, preferences (auto-created at signup)
- `journeys` — the locked route (polyline, distance, time, origin/destination), share token
- Stage 3+: `journey_stops`, `orders`, `reservations`, `booking_requests`, `alerts`

## Honesty rules
- Never invent availability, menus, room stock, prices or fuel stock.
- Fuel info and opening hours only when Google provides them.
- Anything simulated carries a visible "Concept" / "Unconfirmed" label.
- The chosen route is never changed silently.

## Stages
1. **Route planner** — search places, compare routes, select, save, view on map. ✅
2. **Route-based discovery** — sample points along the route, Places search per point, filter by distance from route, detour distance/time, max-detour filter.
3. **Restaurant services** — menus (owner-entered/demo, labelled), pre-order with arrival time, table requests, status tracking.
4. **Petrol pumps** — verified hours/fuel only.
5. **Hotels** — room options (labelled demo), booking requests.
6. **Smart notifications** — distance & ETA alerts for chosen stops.
7. **My Journey + PingME** — upcoming stops, orders/bookings, preferences, journey share QR, vehicle QR concept.
