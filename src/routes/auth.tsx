import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { PingMeMark } from "@/components/roadmate/PingMeMark";
import heroImg from "@/assets/highway-hero.jpg";

function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = safeRedirect(search["redirect"]);
    return r ? { redirect: r } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — PingME RoadMate" },
      { name: "description", content: "Sign in to plan and save your RoadMate road trips." },
      { property: "og:title", content: "Sign in — PingME RoadMate" },
      { property: "og:description", content: "Sign in to plan and save your RoadMate road trips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
  </svg>
);

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const target = redirect ?? "/plan";

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) navigate({ to: target });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: target });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) setSentTo(email);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function demoSignIn() {
    setBusy(true);
    try {
      const demoEmail = "demo@roadmate.app";
      const demoPassword = "DemoPassword123!";
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInErr) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: { data: { full_name: "RoadMate Explorer" } },
        });
        if (signUpErr) throw signUpErr;
      }
      toast.success("Welcome, Demo Explorer!");
      navigate({ to: target });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error(result.error.message ?? "Sign-in failed");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={heroImg} alt="" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover" />
        <div className="hero-scrim absolute inset-0" />
        <div className="absolute bottom-10 left-10 right-10 text-on-image">
          <p className="nh-plate mb-4">PingME · RoadMate</p>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">
            Stops that sit on your road — not 20 km off it.
          </h2>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 flex items-center gap-2">
            <PingMeMark />
            <span className="font-display text-xl font-bold">RoadMate</span>
          </div>

          {sentTo ? (
            <div className="rounded-xl border bg-card p-6 text-center">
              <MailCheck className="mx-auto mb-3 size-10 text-primary" />
              <h1 className="text-xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{sentTo}</strong>. Open it, then come back and sign in.
              </p>
              <Button variant="outline" className="mt-5 w-full" onClick={() => { setSentTo(null); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to plan and save your trips." : "Free. Takes 20 seconds."}
              </p>

              <div className="mt-6 grid gap-2.5">
                <Button
                  type="button"
                  variant="signal"
                  size="xl"
                  className="w-full font-bold"
                  onClick={demoSignIn}
                  disabled={busy}
                >
                  ⚡ One-Click Instant Sign In (Demo)
                </Button>

                <Button variant="google" size="xl" className="w-full" onClick={() => oauth("google")}>
                  <GoogleG /> Continue with Google
                </Button>
                <button type="button" className="lovable-auth-button" onClick={() => oauth("lovable")}>
                  Continue with Lovable
                </button>
              </div>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submit} className="grid gap-3">
                {mode === "signup" && (
                  <input
                    required
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                  />
                )}
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <input
                  required
                  type="password"
                  minLength={6}
                  placeholder="Password (6+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <Button type="submit" size="xl" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New to RoadMate?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
