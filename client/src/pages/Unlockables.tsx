import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Shield, LogIn, Trophy, Sparkles, Star, HeartHandshake, Image as ImageIcon, Upload, Check, X, Crop } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, type ChangeEvent } from "react";
import { Link } from "wouter";
import Cropper, { type Area } from "react-easy-crop";

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

const LEVEL_GRADIENTS: Record<number, string> = {
  1: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", // Slate
  2: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", // Indigo Night
  3: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", // Deep Purple
  4: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)", // Royal Blue
  5: "linear-gradient(135deg, #4338ca 0%, #581c87 100%)", // Mystic Violet
};

const LEVEL_BACKGROUND_LABELS: Record<number, string> = {
  1: "Slate Horizon",
  2: "Indigo Night",
  3: "Deep Purple",
  4: "Royal Blue",
  5: "Mystic Violet",
};

const badgeBackground = (unlockable: { id: number; title: string; imageUrl?: string | null }) => {
  if (unlockable.imageUrl) {
    return `linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.45)), url('${unlockable.imageUrl}')`;
  }

  const palettes = [
    ["255, 221, 89", "79, 70, 229"],
    ["56, 189, 248", "16, 185, 129"],
    ["236, 72, 153", "168, 85, 247"],
    ["245, 158, 11", "190, 24, 93"],
    ["16, 185, 129", "14, 165, 233"],
  ];
  const seed = unlockable.title
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), unlockable.id);
  const [from, to] = palettes[seed % palettes.length];
  return `radial-gradient(circle at top left, rgba(${from}, 0.28), transparent 40%), linear-gradient(135deg, rgba(${from}, 0.45), rgba(${to}, 0.9))`;
};

type BackgroundMode = "level" | "custom";

type BackgroundSettings = {
  enabled: boolean;
  mode: BackgroundMode;
  customImage: string | null;
};

const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  enabled: false,
  mode: "level",
  customImage: null,
};

const criteriaLabel = (criteria: string) => {
  switch (criteria) {
    case "first_quest_completed":
      return "Complete your first quest";
    case "first_medium_quest_completed":
      return "Complete your first Medium quest";
    case "first_hard_quest_completed":
      return "Complete your first Hard quest";
    case "quest_variety_completed":
      return "Complete Easy, Medium, and Hard quests";
    case "five_quests_completed":
      return "Complete 5 quests";
    case "ten_quests_completed":
      return "Complete 10 quests";
    case "legendary_quest_completed":
      return "Complete a Legendary quest";
    case "reach_level_5":
      return "Reach Level 5";
    case "reach_level_10":
      return "Reach Level 10";
    case "daily_streak_3":
      return "Complete 3 daily challenges in a row";
    case "daily_streak_7":
      return "Complete 7 daily challenges in a row";
    default:
      return criteria.replaceAll("_", " ");
  }
};

/**
 * Helper to create the cropped image from the source and pixel area
 */
const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("No 2d context");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL("image/jpeg", 0.85);
};

export default function Unlockables() {
  const { isAuthenticated } = useAuth();
  const { data: unlockables, isLoading: unlockablesLoading } = trpc.unlockables.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: ownedUnlockables, isLoading: ownedLoading } = trpc.unlockables.myUnlockables.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: profile } = trpc.user.profile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const utils = trpc.useUtils();

  const [backgroundSettings, setBackgroundSettings] = useState<BackgroundSettings>(DEFAULT_BACKGROUND_SETTINGS);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

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

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleCustomImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadError(null);
      setImageToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const applyCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setBackgroundSettings((prev) => ({ ...prev, customImage: croppedImage, mode: "custom" }));
      setImageToCrop(null);
      toast.success("Background cropped and applied!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image.");
    }
  };

  const currentLevel = Math.min(profile?.level ?? 1, 5);

  const sectionBackgroundUrl = useMemo(() => {
    if (!backgroundSettings.enabled) return null;
    if (backgroundSettings.mode === "custom" && backgroundSettings.customImage) {
      return backgroundSettings.customImage;
    }
    return null;
  }, [backgroundSettings]);

  const sectionBackgroundLabel = useMemo(() => {
    if (backgroundSettings.mode === "custom") {
      return backgroundSettings.customImage ? "Custom background" : "No custom image uploaded";
    }
    return LEVEL_BACKGROUND_LABELS[currentLevel];
  }, [backgroundSettings, currentLevel]);

  const sectionBackgroundStyle = useMemo(() => {
    if (!backgroundSettings.enabled) return undefined;

    if (backgroundSettings.mode === "custom" && backgroundSettings.customImage) {
      return {
        backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.8), rgba(15,23,42,0.74)), url('${backgroundSettings.customImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }

    return {
      background: LEVEL_GRADIENTS[currentLevel],
    };
  }, [backgroundSettings, currentLevel]);

  const setSelectedBadge = trpc.user.setSelectedBadge.useMutation({
    onSuccess: async () => {
      await utils.user.profile.invalidate();
      toast.success("Profile badge updated.");
    },
    onError: (err) => {
      toast.error(err.message || "Could not update selected badge.");
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unlockables are for signed-in adventurers</h2>
          <p className="text-muted-foreground mb-6">Sign in to track your collection and unlock new rewards.</p>
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

  const ownedIds = new Set(ownedUnlockables?.map((owned) => owned.unlockable.id) ?? []);
  const totalCount = unlockables?.length ?? 0;
  const earnedCount = ownedUnlockables?.length ?? 0;
  const ownedBadges = ownedUnlockables?.filter((owned) => owned.unlockable.category === "badge") ?? [];
  const selectedBadgeId = profile?.selectedBadge?.id ?? null;
  const ownedCollection = ownedUnlockables ?? [];

  return (
    <div className="min-h-screen py-8">
      <div className="container">
        {/* Cropping Modal Overlay */}
        <AnimatePresence>
          {imageToCrop && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="game-card w-full max-w-2xl overflow-hidden"
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crop size={18} className="text-primary" />
                    <h3 className="font-bold">Crop Background</h3>
                  </div>
                  <button onClick={() => setImageToCrop(null)} className="p-2 hover:bg-muted rounded-full transition">
                    <X size={18} />
                  </button>
                </div>
                
                <div className="relative h-[400px] w-full bg-slate-900">
                  <Cropper
                    image={imageToCrop}
                    crop={crop}
                    zoom={zoom}
                    aspect={21 / 9}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Zoom</span>
                      <span>{zoom.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setImageToCrop(null)}
                      className="flex-1 rounded-xl border border-border py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={applyCrop}
                      className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition"
                    >
                      Apply Crop
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-primary font-bold">Reward Vault</p>
              <h1 className="text-4xl font-black tracking-tight">Unlockables</h1>
              <p className="max-w-2xl text-muted-foreground mt-3">
                Track your earned rewards, discover your next collection goal, and see what’s still locked in the vault.
              </p>
            </div>
            <Link href="/dashboard">
              <button className="btn-game px-4 py-2 text-sm">Back to dashboard</button>
            </Link>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] mb-8">
          <div className="game-card p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.35em] text-muted-foreground font-bold">
              <Sparkles size={16} /> Progress Tracker
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-border p-4 bg-background/80">
                <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground mb-2">Collection</div>
                <div className="text-3xl font-black">{earnedCount}</div>
                <div className="text-xs text-muted-foreground mt-1">earned of {totalCount}</div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          id="settings"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="game-card p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Settings</p>
              <h2 className="text-xl font-black tracking-tight">Unlockables Background</h2>
            </div>
            <span className="text-xs text-muted-foreground">Customize the display</span>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-border p-4 bg-background/80">
              <p className="text-sm font-semibold mb-3">Background source</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-3xl border px-4 py-3 text-left transition ${
                    backgroundSettings.mode === "level"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                  onClick={() => setBackgroundSettings((prev) => ({ ...prev, mode: "level" }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Level-based</div>
                    {backgroundSettings.mode === "level" && <Check size={14} />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Each level gets its own smooth gradient.</p>
                </button>

                <button
                  type="button"
                  className={`rounded-3xl border px-4 py-3 text-left transition ${
                    backgroundSettings.mode === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                  onClick={() => setBackgroundSettings((prev) => ({ ...prev, mode: "custom" }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Custom photo</div>
                    {backgroundSettings.mode === "custom" && <Check size={14} />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Upload your own image for the vault section.</p>
                </button>
              </div>
            </div>

            {backgroundSettings.mode === "custom" && (
              <div className="rounded-3xl border border-border p-4 bg-background/80">
                <label className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <Upload size={14} /> Upload an image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomImageUpload}
                  className="block w-full text-xs text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-xs file:font-semibold
                    file:bg-primary/10 file:text-primary
                    hover:file:bg-primary/20 transition-all cursor-pointer"
                />
                {uploadError && <div className="text-xs text-destructive mt-2">{uploadError}</div>}
              </div>
            )}

            <div className="rounded-3xl border border-border p-4 bg-background/80">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Current preview</p>
                <span className="text-xs text-muted-foreground">{backgroundSettings.enabled ? sectionBackgroundLabel : "Disabled in Settings"}</span>
              </div>
              <div 
                className="rounded-3xl overflow-hidden border border-border bg-muted/10 h-48 transition-all duration-500"
                style={backgroundSettings.enabled ? sectionBackgroundStyle : undefined}
              >
                {!backgroundSettings.enabled && (
                  <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                    <Shield size={24} className="opacity-20" />
                    <span>Background disabled in Settings</span>
                  </div>
                )}
                {backgroundSettings.enabled && backgroundSettings.mode === "custom" && !backgroundSettings.customImage && (
                  <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                    <ImageIcon size={24} className="opacity-20" />
                    <span>Upload an image to see preview</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="game-card p-6 mb-8"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-border p-5 bg-background/90">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Profile Badge</p>
                  <h2 className="text-xl font-black tracking-tight">Selected Display Badge</h2>
                </div>
                <span className="text-xs text-muted-foreground">Choose your look</span>
              </div>
              {profile?.selectedBadge ? (
                <div
                  className="relative overflow-hidden rounded-3xl border border-border/50 p-4 text-white"
                  style={{
                    backgroundImage: badgeBackground(profile.selectedBadge),
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-slate-950/30" />
                  <div className="relative">
                    <div className="text-sm font-semibold mb-2">{profile.selectedBadge.title}</div>
                    <p className="text-sm text-white/80 mb-3">{profile.selectedBadge.description}</p>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white">
                      Profile badge active
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
                  No badge selected yet. Select a badge below to display it on your profile.
                </div>
              )}

              {ownedBadges.length > 0 ? (
                <div className="mt-6 space-y-3">
                  <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground mb-3">Owned badge options</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ownedBadges.map((owned) => (
                      <button
                        key={owned.unlockable.id}
                        type="button"
                        className={`relative overflow-hidden rounded-3xl border p-4 text-left text-white transition ${
                          selectedBadgeId === owned.unlockable.id ? "border-primary" : "border-border"
                        }`}
                        style={{
                          backgroundImage: badgeBackground(owned.unlockable),
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        onClick={() => setSelectedBadge.mutate({ unlockableId: owned.unlockable.id })}
                      >
                        <div className="absolute inset-0 bg-slate-950/25" />
                        <div className="relative">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold">{owned.unlockable.title}</div>
                              <p className="text-xs text-white/70 mt-1">{criteriaLabel(owned.unlockable.criteria)}</p>
                            </div>
                            <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white">
                              {CATEGORY_ICONS[owned.unlockable.category] ?? "✨"}
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <span className="text-[11px] text-white/70">Tap to select this badge for your profile.</span>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] ${
                              selectedBadgeId === owned.unlockable.id
                                ? "bg-white/10 text-white"
                                : "bg-white/10 text-white/70"
                            }`}>
                              {selectedBadgeId === owned.unlockable.id ? "Selected" : "Select"}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
                  You do not own any badges yet. Earn badges by completing quests to display them here.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border p-5 bg-background/90">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Shop</p>
                  <h2 className="text-xl font-black tracking-tight">Visit the store</h2>
                </div>
                <span className="text-xs text-muted-foreground">XP-only purchases</span>
              </div>

              <div className="rounded-3xl border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
                <div className="font-semibold text-sm mb-2">A dedicated shop for shop items and rewards</div>
                <div className="mb-3">Browse all available shop items, purchase new cosmetics, titles, and boosts, and manage your inventory in one place.</div>
                <Link href="/shop">
                  <button className="rounded-full bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-primary-foreground hover:bg-primary/90 transition">
                    Go to Shop
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="game-card p-6 mb-8 relative overflow-hidden transition-all duration-700"
          style={sectionBackgroundStyle}
        >
          {backgroundSettings.enabled && (
            <div className="absolute inset-0 bg-slate-950/50 pointer-events-none" />
          )}
          <div className="relative grid gap-4 xl:grid-cols-[0.88fr_0.62fr]">
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="game-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-black tracking-tight">Reward Collection</h2>
                  <p className="text-sm text-muted-foreground mt-1">Explore every reward and see which goals are still in reach.</p>
                </div>
                <div className="rounded-2xl bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                  {totalCount} total
                </div>
              </div>

              {unlockablesLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-48 rounded-3xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {unlockables?.map((unlockable) => {
                    const owned = ownedIds.has(unlockable.id);
                    return (
                      <article
                        key={unlockable.id}
                        className={`rounded-3xl border p-4 overflow-hidden transition-all ${
                          owned ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(114,87,252,0.15)]" : "border-border bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{CATEGORY_ICONS[unlockable.category] ?? "✨"}</span>
                          <div className="space-y-1">
                            <p className="text-sm font-bold">{unlockable.title}</p>
                            <div className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
                              {CATEGORY_LABELS[unlockable.category] ?? unlockable.category}
                            </div>
                            </div>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${owned ? "bg-emerald-500/10 text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                            {owned ? "CLAIMED" : "LOCKED"}
                          </div>
                        </div>
                        {unlockable.imageUrl ? (
                          <img
                            src={unlockable.imageUrl}
                            alt={unlockable.title}
                            className="mb-4 h-28 w-full rounded-2xl object-cover"
                          />
                        ) : null}
                        <p className="text-sm text-muted-foreground mb-4">{unlockable.description}</p>
                        <div className="rounded-3xl border border-border p-3 bg-muted/80 text-[12px] text-muted-foreground">
                          <div className="font-semibold mb-1">Goal</div>
                          <p>{criteriaLabel(unlockable.criteria)}</p>
                        </div>
                        {unlockable.category === "badge" && owned ? (
                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs text-muted-foreground">This badge is owned and can be displayed on your profile.</span>
                            <button
                              type="button"
                              disabled={selectedBadgeId === unlockable.id || setSelectedBadge.isPending}
                              onClick={() => setSelectedBadge.mutate({ unlockableId: unlockable.id })}
                              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
                                selectedBadgeId === unlockable.id
                                  ? "bg-primary/10 text-primary cursor-not-allowed"
                                  : "bg-primary text-primary-foreground hover:bg-primary/90"
                              }`}
                            >
                              {selectedBadgeId === unlockable.id ? "Selected" : "Display badge"}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="game-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black tracking-wider">Recent Achievements</h2>
                <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Latest unlocks</span>
              </div>
              {ownedLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-20 rounded-3xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : !ownedCollection.length ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Earn your first unlockable to see your achievements appear here.
                </div>
              ) : (
                <div className="space-y-3">
                  {ownedCollection.slice(0, 5).map((owned) => (
                    <div key={owned.id} className="rounded-3xl border border-border p-4 bg-background/95">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-2xl bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                          NEW
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold">{owned.unlockable.title}</div>
                          <p className="text-xs text-muted-foreground mt-1">{criteriaLabel(owned.unlockable.criteria)}</p>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{new Date(owned.earnedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
