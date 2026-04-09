import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Crown, Medal, Shield, Star, Trophy, Zap } from "lucide-react";

const LEVEL_TITLES = [
  "Novice",
  "Apprentice",
  "Adventurer",
  "Warrior",
  "Champion",
  "Hero",
  "Legend",
  "Mythic",
  "Immortal",
  "Transcendent",
];

function getLevelTitle(level: number) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">👑</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return (
    <span
      className="text-sm font-black w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted-foreground"
      style={{ fontFamily: "Orbitron, monospace" }}
    >
      {rank}
    </span>
  );
}

function XPBar({ xp, maxXp }: { xp: number; maxXp: number }) {
  const pct = maxXp > 0 ? Math.min(100, (xp / maxXp) * 100) : 0;
  return (
    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
          boxShadow: "0 0 6px oklch(0.72 0.22 165 / 0.5)",
        }}
      />
    </div>
  );
}

export default function Leaderboard() {
  const { user: authUser, isAuthenticated } = useAuth();
  const { data: leaderboard, isLoading } = trpc.user.leaderboard.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const maxXp = leaderboard?.[0]?.xp ?? 1;
  const myRank = leaderboard?.findIndex((p) => p.id === (authUser as any)?.id);

  return (
    <div className="min-h-screen py-8">
      <div className="container max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: "oklch(0.78 0.18 80 / 0.15)",
              border: "1px solid oklch(0.78 0.18 80 / 0.3)",
            }}
          >
            <Trophy size={28} style={{ color: "oklch(0.78 0.18 80)" }} />
          </div>
          <h1 className="text-5xl font-black tracking-wider mb-2">LEADERBOARD</h1>
          <p className="text-muted-foreground">The greatest adventurers of all time</p>
        </motion.div>

        {/* Top 3 Podium */}
        {!isLoading && leaderboard && leaderboard.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-end justify-center gap-4 mb-10"
          >
            {/* 2nd place */}
            <div className="flex flex-col items-center gap-2 flex-1 max-w-[140px]">
              <div className="text-2xl">🥈</div>
              <div
                className="w-full rounded-t-xl p-4 text-center"
                style={{
                  background: "oklch(0.7 0.01 260 / 0.15)",
                  border: "1px solid oklch(0.7 0.01 260 / 0.3)",
                  borderBottom: "none",
                  minHeight: "80px",
                }}
              >
                <div className="text-sm font-bold truncate">{leaderboard[1]?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Lv.{leaderboard[1]?.level}</div>
                <div className="text-xs font-mono text-primary mt-1">{leaderboard[1]?.xp?.toLocaleString()} XP</div>
              </div>
            </div>

            {/* 1st place */}
            <div className="flex flex-col items-center gap-2 flex-1 max-w-[160px]">
              <div className="text-3xl">👑</div>
              <div
                className="w-full rounded-t-xl p-4 text-center"
                style={{
                  background: "oklch(0.78 0.18 80 / 0.15)",
                  border: "1px solid oklch(0.78 0.18 80 / 0.4)",
                  borderBottom: "none",
                  minHeight: "110px",
                  boxShadow: "0 0 20px oklch(0.78 0.18 80 / 0.15)",
                }}
              >
                <div className="text-base font-bold truncate" style={{ color: "oklch(0.78 0.18 80)" }}>
                  {leaderboard[0]?.name ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">Lv.{leaderboard[0]?.level}</div>
                <div className="text-sm font-mono font-black mt-1" style={{ color: "oklch(0.78 0.18 80)" }}>
                  {leaderboard[0]?.xp?.toLocaleString()} XP
                </div>
              </div>
            </div>

            {/* 3rd place */}
            <div className="flex flex-col items-center gap-2 flex-1 max-w-[140px]">
              <div className="text-2xl">🥉</div>
              <div
                className="w-full rounded-t-xl p-4 text-center"
                style={{
                  background: "oklch(0.72 0.22 50 / 0.15)",
                  border: "1px solid oklch(0.72 0.22 50 / 0.3)",
                  borderBottom: "none",
                  minHeight: "70px",
                }}
              >
                <div className="text-sm font-bold truncate">{leaderboard[2]?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Lv.{leaderboard[2]?.level}</div>
                <div className="text-xs font-mono text-primary mt-1">{leaderboard[2]?.xp?.toLocaleString()} XP</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Full List */}
        <div className="flex flex-col gap-2">
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="game-card p-4 animate-pulse flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-1/3 mb-1" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </div>
                  <div className="h-4 bg-muted rounded w-16" />
                </div>
              ))
            : leaderboard?.map((player, i) => {
                const isMe = isAuthenticated && player.id === (authUser as any)?.id;
                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`game-card p-4 flex items-center gap-4 ${isMe ? "border-primary/40" : ""}`}
                    style={isMe ? { boxShadow: "0 0 12px oklch(0.72 0.22 165 / 0.15)" } : {}}
                  >
                    {/* Rank */}
                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                      <RankBadge rank={i + 1} />
                    </div>

                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: "oklch(0.72 0.22 165 / 0.15)",
                        border: "1px solid oklch(0.72 0.22 165 / 0.3)",
                        color: "oklch(0.72 0.22 165)",
                      }}
                    >
                      {(player.name ?? "?")[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{player.name ?? "Anonymous"}</span>
                        {isMe && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          Lv.{player.level} · {getLevelTitle(player.level ?? 1)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <XPBar xp={player.xp ?? 0} maxXp={maxXp} />
                      </div>
                    </div>

                    {/* XP */}
                    <div
                      className="text-sm font-black text-right flex-shrink-0"
                      style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}
                    >
                      {(player.xp ?? 0).toLocaleString()}
                      <div className="text-xs font-normal text-muted-foreground">XP</div>
                    </div>
                  </motion.div>
                );
              })}
        </div>

        {/* My rank callout */}
        {isAuthenticated && myRank !== undefined && myRank >= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 p-4 rounded-xl text-center"
            style={{
              background: "oklch(0.72 0.22 165 / 0.08)",
              border: "1px solid oklch(0.72 0.22 165 / 0.2)",
            }}
          >
            <span className="text-sm text-muted-foreground">Your current rank: </span>
            <span className="text-primary font-black text-lg" style={{ fontFamily: "Orbitron, monospace" }}>
              #{myRank + 1}
            </span>
          </motion.div>
        )}

        {!isLoading && (!leaderboard || leaderboard.length === 0) && (
          <div className="text-center py-16">
            <Trophy size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold text-muted-foreground">No Players Yet</h3>
            <p className="text-sm text-muted-foreground/60 mt-2">Be the first to complete a quest!</p>
          </div>
        )}
      </div>
    </div>
  );
}
