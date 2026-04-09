import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Filter,
  Flame,
  Plus,
  Search,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

type Difficulty = "all" | "easy" | "medium" | "hard" | "legendary";
type StatusFilter = "all" | "active" | "expired";

const DIFF_LABELS: Record<string, string> = {
  easy: "EASY",
  medium: "MEDIUM",
  hard: "HARD",
  legendary: "LEGENDARY",
};

const DIFF_XP_RANGE: Record<string, string> = {
  easy: "10–100 XP",
  medium: "100–500 XP",
  hard: "500–1500 XP",
  legendary: "1500–5000 XP",
};

function QuestCountdown({ expiresAt }: { expiresAt: Date | null }) {
  if (!expiresAt) return null;
  const now = new Date();
  const diff = new Date(expiresAt).getTime() - now.getTime();
  if (diff <= 0) return <span className="text-xs text-destructive font-mono">EXPIRED</span>;

  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const isUrgent = diff < 3600000 * 2;

  return (
    <span
      className={`text-xs font-mono flex items-center gap-1 ${
        isUrgent ? "text-destructive animate-pulse" : "text-muted-foreground"
      }`}
    >
      <Clock size={10} />
      {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
    </span>
  );
}

function QuestCard({ quest, creator, index }: {
  quest: any;
  creator: any;
  index: number;
}) {
  const isExpired = quest.status === "expired";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/quests/${quest.id}`}>
        <div className={`game-card p-5 cursor-pointer ${isExpired ? "opacity-60" : ""}`}>
          {/* Top row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge-${quest.difficulty}`}>
                {DIFF_LABELS[quest.difficulty]}
              </span>
              {isExpired && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                  EXPIRED
                </span>
              )}
              {quest.expiresAt && !isExpired && (
                <QuestCountdown expiresAt={quest.expiresAt} />
              )}
            </div>
            <div
              className="text-sm font-black whitespace-nowrap"
              style={{
                fontFamily: "Orbitron, monospace",
                color: "oklch(0.72 0.22 165)",
              }}
            >
              +{quest.xpReward} XP
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold mb-2 leading-tight line-clamp-2">{quest.title}</h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
            {quest.description}
          </p>

          {/* Requirements */}
          <div className="flex items-center gap-3 mb-4 text-xs">
            {quest.requirementType === "team" && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <Users size={12} />
                TEAM
              </span>
            )}
            {quest.requirementType === "individual" && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30">
                <Swords size={12} />
                SOLO
              </span>
            )}
            {quest.requiredMediaCount && quest.requiredMediaCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                📸 {quest.requiredMediaCount} FILE{quest.requiredMediaCount > 1 ? "S" : ""}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {creator?.name && (
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {creator.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Trophy size={11} />
                {quest.completionCount} completed
              </span>
            </div>
            <div className="text-xs text-primary font-semibold flex items-center gap-1">
              VIEW QUEST
              <Swords size={11} />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function QuestFeed() {
  const { isAuthenticated } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");

  const { data: questRows, isLoading } = trpc.quest.list.useQuery(
    {
      difficulty: difficulty !== "all" ? difficulty : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    },
    { refetchInterval: 30000 }
  );

  const filtered = (questRows ?? []).filter((row) => {
    if (!search) return true;
    return (
      row.quest.title.toLowerCase().includes(search.toLowerCase()) ||
      row.quest.description.toLowerCase().includes(search.toLowerCase())
    );
  });

  const difficultyOptions: { value: Difficulty; label: string }[] = [
    { value: "all", label: "ALL" },
    { value: "easy", label: "EASY" },
    { value: "medium", label: "MEDIUM" },
    { value: "hard", label: "HARD" },
    { value: "legendary", label: "LEGENDARY" },
  ];

  return (
    <div className="min-h-screen py-8">
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl font-black tracking-wider mb-1">QUEST BOARD</h1>
            <p className="text-muted-foreground text-sm">
              {filtered.length} quest{filtered.length !== 1 ? "s" : ""} available
            </p>
          </div>
          {isAuthenticated && (
            <Link href="/create-quest">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm tracking-wider"
                style={{
                  background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                  color: "oklch(0.08 0.01 260)",
                  boxShadow: "0 0 16px oklch(0.72 0.22 165 / 0.3)",
                }}
              >
                <Plus size={15} />
                CREATE QUEST
              </button>
            </Link>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search quests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 p-1 rounded-lg bg-secondary border border-border">
            {(["all", "active", "expired"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-bold tracking-wider transition-all ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Difficulty filter */}
          <div className="flex gap-1 p-1 rounded-lg bg-secondary border border-border overflow-x-auto">
            {difficultyOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`px-3 py-1 rounded-md text-xs font-bold tracking-wider whitespace-nowrap transition-all ${
                  difficulty === opt.value
                    ? opt.value === "all"
                      ? "bg-primary text-primary-foreground"
                      : `badge-${opt.value}`
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Quest Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="game-card p-5 animate-pulse">
                <div className="h-4 bg-muted rounded mb-3 w-1/3" />
                <div className="h-6 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded mb-1 w-4/5" />
                <div className="h-4 bg-muted rounded w-3/5" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <Swords size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold text-muted-foreground mb-2">No Quests Found</h3>
            <p className="text-sm text-muted-foreground/60 mb-6">
              {search ? "Try a different search term" : "No quests match your filters"}
            </p>
            {isAuthenticated && (
              <Link href="/create-quest">
                <button className="btn-game px-5 py-2 text-sm">
                  <Plus size={14} />
                  CREATE THE FIRST QUEST
                </button>
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((row, i) => (
                <QuestCard
                  key={row.quest.id}
                  quest={row.quest}
                  creator={row.creator}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Login CTA */}
        {!isAuthenticated && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 text-center p-8 rounded-2xl border border-primary/20 bg-primary/5"
          >
            <Flame size={32} className="mx-auto text-primary mb-3" />
            <h3 className="text-xl font-bold mb-2">Ready to Take On a Quest?</h3>
            <p className="text-muted-foreground text-sm mb-4">Sign in to start completing quests and earning XP</p>
            <a href={getLoginUrl()}>
              <button
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
                style={{
                  background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                  color: "oklch(0.08 0.01 260)",
                }}
              >
                <Zap size={14} />
                SIGN IN TO PLAY
              </button>
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}
