import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Public & signed-in area. Supports both signed-in users and instant guest access.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        return { user: data.user };
      }
    } catch {
      // Supabase not configured or offline
    }
    // Default guest session so anyone with the link can explore and plan freely
    return {
      user: {
        id: "guest-user",
        email: "guest@roadmate.app",
        user_metadata: { full_name: "RoadMate Explorer" },
      },
    };
  },
  component: () => <Outlet />,
});
