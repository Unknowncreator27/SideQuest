import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Shield, LogIn, Trophy } from "lucide-react";
import { Link } from "wouter";

export default function Unlockables() {
  const { isAuthenticated } = useAuth();
  const { data: unlockables, isLoading: unlockablesLoading } = trpc.unlockables.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: ownedUnlockables, isLoading: ownedLoading } = trpc.unlockables.myUnlockables.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">You need to sign in to view your unlockables.</p>
          <Link href="/login">
            <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))", color: "oklch(0.08 0.01 260)" }}>
              <LogIn size={14} />
              SIGN IN
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const earnedCount = ownedUnlockables?.length ?? 0;
  const ownedIds = new Set(ownedUnlockables?.map((owned) => owned.unlockable.id) ?? []);
  const nextUnlockable = unlockables?.find((unlockable) => !ownedIds.has(unlockable.id));

  return (
    <div className="min-h-screen py-8">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-black tracking-wider mb-1">UNLOCKABLES</h1>
          <p className="text-muted-foreground text-sm">Earn badges, cosmetics, titles, and boosts as you complete quests.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-3 sm:grid-cols-2 mb-8"
        >
          <div className="game-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Trophy size={18} />
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground font-bold">Earned</div>
            </div>
            <div className="text-3xl font-black">{earnedCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Unlockables earned so far</div>
          </div>
          <div className="game-card p-6">
            <div className="text-sm font-semibold mb-2">Next possible reward</div>
            {nextUnlockable ? (
              <div>
                <div className="font-semibold text-foreground">{nextUnlockable.title}</div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground my-2">{nextUnlockable.category}</div>
                <div className="text-xs text-muted-foreground">{nextUnlockable.description}</div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">You have earned all available unlockables. Great work!</div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid gap-4 lg:grid-cols-2"
        >
          <div className="game-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black tracking-wider">Available Unlockables</h2>
            </div>
            {unlockablesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : !unlockables?.length ? (
              <div className="text-sm text-muted-foreground">No unlockables available yet.</div>
            ) : (
              <div className="space-y-3">
                {unlockables.map((unlockable) => (
                  <div key={unlockable.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{unlockable.title}</div>
                        <div className="text-xs text-muted-foreground">{unlockable.category.toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">{unlockable.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="game-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black tracking-wider">Your Earned Unlockables</h2>
            </div>
            {ownedLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : !ownedUnlockables?.length ? (
              <div className="text-sm text-muted-foreground">Earn your first unlockable by completing quests and leveling up.</div>
            ) : (
              <div className="space-y-3">
                {ownedUnlockables.map((owned) => (
                  <div key={owned.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{owned.unlockable.title}</div>
                        <div className="text-xs text-muted-foreground">Earned on {new Date(owned.earnedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">{owned.unlockable.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
