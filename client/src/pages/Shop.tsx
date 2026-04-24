import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Shield, Zap, Sparkles, Star, Trophy, Loader2 } from "lucide-react";
import { Link } from "wouter";

const CATEGORY_LABELS: Record<string, string> = {
  badge: "Badge",
  cosmetic: "Cosmetic",
  title: "Title",
  boost: "Boost",
};

const CATEGORY_ICONS: Record<string, string> = {
  badge: "🏅",
  cosmetic: "🧢",
  title: "📝",
  boost: "⚡",
};

const SHOP_UNLOCK_LEVEL = 5;

export default function Shop() {
  const { isAuthenticated } = useAuth();
  const { data: profile } = trpc.user.profile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const shopUnlocked = profile?.level != null && profile.level >= SHOP_UNLOCK_LEVEL;
  const { data: shopItems, isLoading: shopLoading } = trpc.shop.list.useQuery(undefined, {
    enabled: shopUnlocked,
  });
  const { data: ownedShopItems, isLoading: ownedShopLoading } = trpc.shop.myItems.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const utils = trpc.useUtils();

  const buyShopItem = trpc.shop.buy.useMutation({
    onSuccess: async () => {
      await utils.shop.list.invalidate();
      await utils.shop.myItems.invalidate();
      await utils.user.profile.invalidate();
      toast.success("Purchase complete! Your new shop item is now owned.");
    },
    onError: (err) => {
      toast.error(err.message || "Could not complete the purchase.");
    },
  });

  const isBuying = buyShopItem.isPending;
  const ownedIds = new Set(ownedShopItems?.map((owned) => owned.unlockable.id) ?? []);
  const xp = profile?.xp ?? 0;
  const currentLevel = profile?.level ?? 1;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-6 py-10 rounded-3xl border border-border bg-background/90 shadow-xl">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Welcome to the Shop</h2>
          <p className="text-muted-foreground mb-6">Sign in to browse items, spend XP, and equip your favorite rewards.</p>
          <Link href="/login">
            <button className="btn-game px-6 py-2.5 text-sm">SIGN IN</button>
          </Link>
        </div>
      </div>
    );
  }

  if (!shopUnlocked) {
    return (
      <div className="min-h-screen py-16">
        <div className="container">
          <div className="game-card p-8 text-center">
            <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
              <Zap size={28} />
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-3">Shop Locked</h1>
            <p className="max-w-2xl mx-auto text-muted-foreground mb-6">
              The shop unlocks once you reach Level {SHOP_UNLOCK_LEVEL}. Keep completing quests to earn XP and level up.
            </p>
            <div className="grid gap-4 md:grid-cols-2 mt-6">
              <div className="rounded-3xl border border-border p-6 bg-background">
                <div className="text-sm uppercase tracking-[0.35em] text-muted-foreground font-bold">Your Level</div>
                <div className="text-5xl font-black mt-3">{profile?.level ?? 1}</div>
              </div>
              <div className="rounded-3xl border border-border p-6 bg-background">
                <div className="text-sm uppercase tracking-[0.35em] text-muted-foreground font-bold">XP Balance</div>
                <div className="text-5xl font-black mt-3">{profile?.xp ?? 0}</div>
              </div>
            </div>
            <Link href="/unlockables">
              <button className="btn-game mt-8 px-6 py-3 text-sm">See unlockables</button>
            </Link>
          </div>
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
              <p className="text-sm uppercase tracking-[0.35em] text-primary font-bold">Side Quest Shop</p>
              <h1 className="text-4xl font-black tracking-tight">Style, titles, and boosts</h1>
              <p className="max-w-2xl text-muted-foreground mt-3">
                Spend earned XP on shop items and customize your profile with new rewards.
              </p>
            </div>
            <Link href="/dashboard">
              <button className="btn-game px-4 py-2 text-sm">Back to dashboard</button>
            </Link>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] mb-8">
          <div className="game-card p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.35em] text-muted-foreground font-bold">
              <Zap size={16} /> Shop Access
            </div>
            <div className="rounded-3xl border border-border p-5 bg-background/80">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Current level</div>
                  <div className="text-3xl font-black">{currentLevel}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">XP balance</div>
                  <div className="text-3xl font-black">{xp}</div>
                </div>
              </div>
              <div className="mt-4 rounded-full bg-border/50 h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (currentLevel / SHOP_UNLOCK_LEVEL) * 100)}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Shop unlocks at Level {SHOP_UNLOCK_LEVEL}. You are currently Level {currentLevel}.
              </div>
            </div>
          </div>

          <div className="game-card p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.35em] text-muted-foreground font-bold">
              <Sparkles size={16} /> Owned</div>
            <div className="rounded-3xl border border-border p-5 bg-background/90">
              <div className="text-sm text-muted-foreground">Shop items owned</div>
              <div className="text-3xl font-black mt-2">{ownedShopItems?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-2">These are items you've purchased from the shop.</div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="game-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Shop Catalog</p>
              <h2 className="text-xl font-black tracking-tight">Available Items</h2>
            </div>
            <span className="text-xs text-muted-foreground">Spend XP</span>
          </div>

          {shopLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 rounded-3xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : !shopItems || shopItems.length === 0 ? (
            <div className="rounded-3xl border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
              No shop items are available right now.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {shopItems.map((item) => {
                const owned = ownedIds.has(item.id);
                const canBuy = xp >= item.priceXp;
                return (
                  <div key={item.id} className="rounded-3xl border border-border p-5 bg-background">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground mt-1">
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{item.priceXp} XP</div>
                        <div className="text-[11px] text-muted-foreground">Price</div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground my-4">{item.description}</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{owned ? "Already owned" : `Requires ${item.priceXp} XP`}</span>
                      <button
                        type="button"
                        className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] transition ${
                          !shopUnlocked || owned || !canBuy
                            ? "bg-secondary text-muted-foreground cursor-not-allowed"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                        disabled={!shopUnlocked || owned || isBuying || !canBuy}
                        onClick={() => buyShopItem.mutate({ unlockableId: item.id })}
                      >
                        {owned ? (
                          "Owned"
                        ) : !shopUnlocked ? (
                          "Locked"
                        ) : isBuying ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Buying...
                          </>
                        ) : canBuy ? (
                          "Buy"
                        ) : (
                          "Need more XP"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {ownedShopItems?.length ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="game-card p-6 mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Inventory</p>
                <h2 className="text-xl font-black tracking-tight">Your shop items</h2>
              </div>
              <span className="text-xs text-muted-foreground">Owned items</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {ownedShopItems.map((owned) => (
                <div key={owned.unlockable.id} className="rounded-3xl border border-border p-4 bg-background">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{owned.unlockable.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">{CATEGORY_LABELS[owned.unlockable.category] ?? owned.unlockable.category}</div>
                    </div>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                      Owned
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
