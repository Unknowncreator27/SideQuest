import { useAuth } from "@/_core/hooks/useAuth";
import { motion } from "framer-motion";
import { Shield, LogIn } from "lucide-react";
import { Link } from "wouter";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";

type BackgroundSettings = {
  enabled: boolean;
  mode: "level" | "custom";
  customImage: string | null;
};

const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  enabled: false,
  mode: "level",
  customImage: null,
};

export default function Settings() {
  const { isAuthenticated, logout } = useAuth();
  const [backgroundSettings, setBackgroundSettings] = useState<BackgroundSettings>(DEFAULT_BACKGROUND_SETTINGS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("unlockablesSectionBackgroundSettings");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<BackgroundSettings>;
      setBackgroundSettings((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore invalid saved settings
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("unlockablesSectionBackgroundSettings", JSON.stringify(backgroundSettings));
  }, [backgroundSettings]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Settings are for signed-in adventurers</h2>
          <p className="text-muted-foreground mb-6">Sign in to manage your account settings.</p>
          <Link href="/login">
            <button
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
              style={{
                background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                color: "oklch(0.08 0.01 260)",
              }}
            >
              <LogIn size={14} />
              SIGN IN
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-primary font-bold">Account</p>
              <h1 className="text-4xl font-black tracking-tight">Settings</h1>
              <p className="max-w-2xl text-muted-foreground mt-3">
                Manage your account and preferences.
              </p>
            </div>
            <Link href="/dashboard">
              <button className="btn-game px-4 py-2 text-sm">Back to dashboard</button>
            </Link>
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="game-card p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Display</p>
              <h2 className="text-xl font-black tracking-tight">Unlockables Background</h2>
            </div>
            <span className="text-xs text-muted-foreground">Quick toggle</span>
          </div>

          <div className="rounded-3xl border border-border p-4 bg-background/80 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Enable background imagery</p>
              <p className="text-xs text-muted-foreground mt-1">Use a hero image behind the unlockables section. Customize it on the Unlockables page.</p>
            </div>
            <Switch
              checked={backgroundSettings.enabled}
              onCheckedChange={(value) => setBackgroundSettings((prev) => ({ ...prev, enabled: value as boolean }))}
            />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="game-card p-6"
        >
          <div className="rounded-3xl border border-border p-4 bg-background/80">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-lg font-extrabold uppercase text-red-400 flex items-center gap-2">
                  <span>⚠️</span> Danger Zone
                </p>
                <p className="text-sm text-red-300 mt-1">
                  Proceed with caution.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">Account</p>
                <p className="text-xs text-muted-foreground mt-1">Sign out or refresh your session from here.</p>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-destructive-foreground hover:bg-destructive/90 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
