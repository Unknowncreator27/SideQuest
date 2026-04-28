import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Zap, Swords, Trophy } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoryItem = {
  id: string;
  type: string;
  userName: string;
  userAvatar?: string | null;
  title: string;
  detail: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: Date | string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "oklch(0.72 0.22 165)",
  medium: "oklch(0.72 0.22 50)",
  hard: "oklch(0.65 0.25 25)",
  legendary: "oklch(0.65 0.25 290)",
};

function getDifficultyColor(detail: string) {
  const lower = detail.toLowerCase();
  for (const [key, val] of Object.entries(DIFFICULTY_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return "oklch(0.72 0.22 165)";
}

function Avatar({ name, avatar, size = 40 }: { name: string; avatar?: string | null; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: "oklch(0.72 0.22 165 / 0.2)",
        border: "2px solid oklch(0.72 0.22 165)",
      }}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span
          className="font-black text-primary"
          style={{ fontSize: size * 0.38, fontFamily: "Orbitron, monospace" }}
        >
          {name?.[0]?.toUpperCase() ?? "?"}
        </span>
      )}
    </div>
  );
}

// ─── Story Viewer (fullscreen modal) ─────────────────────────────────────────

const STORY_DURATION = 5000;

function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: StoryItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const accumulatedRef = useRef<number>(0);

  const story = stories[current];

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= stories.length) {
      onClose();
      return;
    }
    setCurrent(index);
    setProgress(0);
    accumulatedRef.current = 0;
    startTimeRef.current = Date.now();
  }, [stories.length, onClose]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Progress ticker
  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      accumulatedRef.current += Date.now() - startTimeRef.current;
      return;
    }

    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = accumulatedRef.current + (Date.now() - startTimeRef.current);
      const pct = Math.min(elapsed / STORY_DURATION, 1);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(intervalRef.current!);
        next();
      }
    }, 30);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [current, paused, next]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose]);

  if (!story) return null;

  const isVideo = story.mediaType === "video";
  const hasMedia = story.mediaUrl && !story.mediaUrl.startsWith("pending-review://");
  const accentColor = getDifficultyColor(story.detail);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "oklch(0.04 0.01 260 / 0.95)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      {/* Story card */}
      <motion.div
        key={current}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "oklch(0.1 0.015 260)",
          border: `1px solid ${accentColor}40`,
          boxShadow: `0 0 60px ${accentColor}30, 0 24px 48px oklch(0 0 0 / 0.6)`,
          aspectRatio: "9/16",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
          {stories.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-0.5 rounded-full overflow-hidden"
              style={{ background: "oklch(1 0 0 / 0.25)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: accentColor }}
                animate={{
                  width: i < current ? "100%" : i === current ? `${progress * 100}%` : "0%",
                }}
                transition={{ duration: i === current ? 0 : 0.1 }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 z-20 px-4 flex items-center gap-3">
          <div
            className="rounded-full p-0.5"
            style={{ background: `linear-gradient(135deg, ${accentColor}, oklch(0.65 0.25 290))` }}
          >
            <Avatar name={story.userName} avatar={story.userAvatar} size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-black tracking-wider truncate"
              style={{ fontFamily: "Orbitron, monospace", color: accentColor }}
            >
              {story.userName}
            </div>
            <div className="text-[10px] text-white/50">
              {new Date(story.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-colors"
            style={{ background: "oklch(1 0 0 / 0.1)" }}
          >
            <X size={14} className="text-white/70" />
          </button>
        </div>

        {/* Media */}
        {hasMedia ? (
          <div className="absolute inset-0">
            {isVideo ? (
              <video
                src={story.mediaUrl!}
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={story.mediaUrl!}
                alt={story.title}
                className="w-full h-full object-cover"
              />
            )}
            {/* Gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to bottom, oklch(0 0 0 / 0.5) 0%, transparent 30%, transparent 55%, oklch(0 0 0 / 0.85) 100%)",
              }}
            />
          </div>
        ) : (
          // No media — decorative fallback
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, ${accentColor}20 0%, oklch(0.08 0.01 260) 70%)`,
            }}
          >
            <div
              className="p-8 rounded-full"
              style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
            >
              {story.type === "level_up" ? (
                <Zap size={56} style={{ color: accentColor }} />
              ) : story.type === "unlockable_earned" ? (
                <Trophy size={56} style={{ color: accentColor }} />
              ) : (
                <Swords size={56} style={{ color: accentColor }} />
              )}
            </div>
          </div>
        )}

        {/* Footer content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-5">
          {/* XP badge */}
          <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest"
            style={{
              background: `${accentColor}20`,
              border: `1px solid ${accentColor}50`,
              color: accentColor,
            }}
          >
            <Zap size={10} />
            {story.detail}
          </div>
          <h3 className="text-white font-black text-xl leading-tight mb-1">{story.title}</h3>
          <p className="text-white/50 text-xs">
            {story.type === "quest_completion" ? "Quest Completed" : story.type === "level_up" ? "Level Up!" : "Achievement Unlocked"}
          </p>
        </div>

        {/* Tap zones */}
        <button
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
          onClick={prev}
          aria-label="Previous story"
        />
        <button
          className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
          onClick={next}
          aria-label="Next story"
        />
      </motion.div>

      {/* Arrow nav (desktop) */}
      {current > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors hidden md:flex items-center justify-center"
          style={{ background: "oklch(1 0 0 / 0.1)", border: "1px solid oklch(1 0 0 / 0.15)" }}
          onClick={prev}
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
      )}
      {current < stories.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors hidden md:flex items-center justify-center"
          style={{ background: "oklch(1 0 0 / 0.1)", border: "1px solid oklch(1 0 0 / 0.15)" }}
          onClick={next}
        >
          <ChevronRight size={20} className="text-white" />
        </button>
      )}
    </motion.div>
  );
}

// ─── Story Bubble (single avatar in the strip) ────────────────────────────────

function StoryBubble({
  story,
  index,
  onClick,
  seen,
}: {
  story: StoryItem;
  index: number;
  onClick: () => void;
  seen: boolean;
}) {
  const accentColor = getDifficultyColor(story.detail);
  const hasMedia = story.mediaUrl && !story.mediaUrl.startsWith("pending-review://");

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 280, damping: 22 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 flex-shrink-0 group"
      style={{ width: 72 }}
    >
      {/* Ring + avatar */}
      <div className="relative">
        <div
          className="rounded-full p-0.5 transition-all duration-300 group-hover:scale-105"
          style={{
            background: seen
              ? "oklch(0.3 0.01 260)"
              : `linear-gradient(135deg, ${accentColor}, oklch(0.65 0.25 290))`,
            boxShadow: seen ? "none" : `0 0 16px ${accentColor}60`,
          }}
        >
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: 56,
              height: 56,
              background: "oklch(0.11 0.015 260)",
              border: "2px solid oklch(0.08 0.01 260)",
            }}
          >
            {hasMedia ? (
              story.mediaType === "video" ? (
                <video
                  src={story.mediaUrl!}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={story.mediaUrl!}
                  alt={story.userName}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: `${accentColor}15` }}
              >
                <span
                  className="font-black"
                  style={{ fontFamily: "Orbitron, monospace", color: accentColor, fontSize: 18 }}
                >
                  {story.userName?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Type indicator dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2"
          style={{
            background: "oklch(0.08 0.01 260)",
            borderColor: "oklch(0.08 0.01 260)",
          }}
        >
          {story.type === "level_up" ? (
            <Zap size={9} style={{ color: "oklch(0.72 0.22 50)" }} />
          ) : story.type === "unlockable_earned" ? (
            <Trophy size={9} style={{ color: "oklch(0.65 0.25 290)" }} />
          ) : (
            <Swords size={9} style={{ color: accentColor }} />
          )}
        </div>
      </div>

      {/* Username */}
      <span
        className="text-[9px] font-bold tracking-wider truncate w-full text-center text-muted-foreground group-hover:text-primary transition-colors"
        style={{ maxWidth: 68 }}
      >
        {story.userName.split(" ")[0].toUpperCase()}
      </span>
    </motion.button>
  );
}

// ─── Story Strip (exported) ───────────────────────────────────────────────────

export function StoryStrip({ stories }: { stories: StoryItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const open = (index: number) => {
    setActiveIndex(index);
    setSeen((prev) => new Set([...prev, index]));
  };

  const close = () => setActiveIndex(null);

  if (stories.length === 0) return null;

  return (
    <>
      {/* Strip */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative py-4"
        style={{
          borderBottom: "1px solid oklch(0.2 0.02 260)",
        }}
      >
        {/* Fade edges */}
        <div
          className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, var(--background), transparent)" }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to left, var(--background), transparent)" }}
        />

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto px-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {stories.map((story, i) => (
            <StoryBubble
              key={story.id}
              story={story}
              index={i}
              onClick={() => open(i)}
              seen={seen.has(i)}
            />
          ))}
        </div>
      </motion.div>

      {/* Viewer */}
      <AnimatePresence>
        {activeIndex !== null && (
          <StoryViewer
            stories={stories}
            startIndex={activeIndex}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </>
  );
}