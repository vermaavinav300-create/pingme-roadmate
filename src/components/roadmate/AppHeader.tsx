import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PingMeMark } from "./PingMeMark";

export function AppHeader() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <PingMeMark />
          <span className="flex items-baseline gap-1.5 leading-none">
            <span className="text-xs font-semibold text-muted-foreground">PingME</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-display text-lg font-bold tracking-tight">RoadMate</span>
          </span>
        </Link>
        <nav className="ml-4 flex items-center gap-1 text-sm font-semibold">
          <Link
            to="/plan"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:text-foreground"
            activeProps={{ className: "bg-secondary text-secondary-foreground" }}
          >
            Plan
          </Link>
          <Link
            to="/journeys"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:text-foreground"
            activeProps={{ className: "bg-secondary text-secondary-foreground" }}
          >
            My Journeys
          </Link>
          <Link
            to="/orders"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:text-foreground"
            activeProps={{ className: "bg-secondary text-secondary-foreground" }}
          >
            Orders & Requests
          </Link>
          <Link
            to="/merchant"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:text-foreground"
            activeProps={{ className: "bg-secondary text-secondary-foreground" }}
          >
            Merchant Portal
          </Link>
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut /> <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
