# PingMe RoadMate

You are an expert full-stack developer, software architect and UI/UX designer.

I am participating in a 12-hour entrepreneurship hackathon. I have a team of three members, and none of us knows programming.

I want to build an application called PINGME ROADMATE.

PRODUCT IDEA:

A road-trip companion that helps people travelling long distances discover restaurants, petrol pumps, hotels and other facilities along their selected driving route.

CORE REQUIREMENT:

The application must show services relevant to the route selected by the user, not random nearby places or unrelated alternative routes.

MAIN FEATURES:

1. ROUTE PLANNER

- Enter starting point and destination.

- Display available driving routes.

- Allow the user to select one route.

- Save the selected route.

- Display the selected route on an interactive map.

2. ROUTE-BASED DISCOVERY

- Discover restaurants, petrol pumps and hotels along the selected route.

- Display name, rating, photographs, address and location when available.

- Show the distance from the selected route.

- Calculate additional detour distance and time.

- Allow the user to filter places based on maximum detour distance.

3. RESTAURANT SERVICES

- Display restaurant menus.

- Allow advance food ordering.

- Allow users to choose an estimated arrival time.

- Provide a table reservation request option.

- Show the status of each order or reservation.

4. PETROL PUMPS

- Show petrol pumps along the selected route.

- Show their distance and detour time.

- Display opening hours and fuel information only when verified.

5. HOTEL SERVICES

- Show hotels along the selected route.

- Allow users to view room options.

- Provide a booking request interface.

6. SMART NOTIFICATIONS

- Notify travellers before reaching selected restaurants, petrol pumps and hotels.

- Support distance-based and estimated-arrival-time alerts.

- Never silently modify the user's chosen route.

7. MY JOURNEY

- Save the selected journey.

- Show upcoming stops.

- Display orders and bookings.

- Allow users to manage their preferences.

TECHNOLOGY:

Use a simple, beginner-friendly full-stack web architecture.

Use Google Maps Platform for map display, route calculation and places discovery along routes.

Use Supabase for persistent database storage and authentication.

Use secure server-side handling for API keys.

PINGME INTEGRATION:

Make RoadMate a new service inside the PingME Super App.

Include a vehicle QR integration concept and a shareable journey QR feature. Do not claim access to PingME's production backend.

IMPORTANT RULES:

- We are complete beginners.

- Do not expect us to write code manually.

- Generate the code and configure the application.

- Explain every setup step in plain English.

- Ask us for API credentials only when needed.

- Never expose API secrets in public frontend code.

- Test the application after making changes.

- Use actual persistent data for orders and booking requests.

- Clearly label simulated integrations and unconfirmed bookings.

- Do not fabricate restaurant availability, hotel availability or petrol stock information.

FIRST TASK:

Before coding, create the complete application architecture, identify all required API credentials and services, and divide the project into small development stages.

Then build the route planner and route-selection functionality first.

Do not attempt all features simultaneously. Ensure each stage works before adding the next one.

Our goal is to create a working, impressive hackathon prototype within 12 hours.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/33cce8d0-ca6f-5847-ac37-c241979e9cfc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
