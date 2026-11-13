<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Google Maps server APIs (Routes, Places) are called only from `createServerFn` handlers via `src/lib/google-maps.server.ts` (connector gateway) and require a signed-in user — keeps keys server-side and bounds billable usage.
- The browser loads Maps JS once through `src/lib/google-maps-loader.ts` with the browser key; polyline colors live in `src/lib/map-theme.ts` because Google Maps cannot read CSS variables.
- Pure route math/formatting lives in `src/lib/route-utils.ts` (browser-safe, unit-tested) so server and UI share one definition.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate); public pages are top-level.
- Architecture and stage plan: `docs/ARCHITECTURE.md`; open work: `roadmap.md`.
