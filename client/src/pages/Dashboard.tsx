import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Clock,
  Crown,
  LogIn,
  Plus,
  Shield,
  Swords,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

const LEVEL_TITLES = [
  "Novice", "Apprentice", "Adventurer", "Warrior", "Champion",
  "Hero", "Legend", "Mythic", "Immortal", "Transcendent",
];

function getLevelTitle(level: number) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

function getProposalDurationLabel(duration?: string | null) {
  if (!duration || duration === "none") return "NONE";
  switch (duration) {
    case "1h": return "1 HR";
    case "6h": return "6 HRS";
    case "24h": return "24 HRS";
    case "7d": return "7 DAYS";
    case "30d": return "30 DAYS";
    default: return duration.toUpperCase();
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ background: "oklch(0.72 0.22 165 / 0.15)", color: "oklch(0.72 0.22 165)", border: "1px solid oklch(0.72 0.22 165 / 0.3)" }}>
        <CheckCircle size={10} /> VERIFIED
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ background: "oklch(0.65 0.25 25 / 0.15)", color: "oklch(0.65 0.25 25)", border: "1px solid oklch(0.65 0.25 25 / 0.3)" }}>
        <XCircle size={10} /> REJECTED
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: "oklch(0.72 0.22 50 / 0.15)", color: "oklch(0.72 0.22 50)", border: "1px solid oklch(0.72 0.22 50 / 0.3)" }}>
      <Clock size={10} /> PENDING
    </span>
  );
}

function formatProposalTimeLimit(start?: string | Date, end?: string | Date) {
  if (!start || !end) return null;
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs <= 0) return null;
  if (diffMs % (24 * 60 * 60 * 1000) === 0) return `${diffMs / (24 * 60 * 60 * 1000)}h`;
  if (diffMs % (60 * 60 * 1000) === 0) return `${diffMs / (60 * 60 * 1000)}h`;
  if (diffMs % (60 * 1000) === 0) return `${diffMs / (60 * 1000)}m`;
  return `${Math.round(diffMs / 1000)}s`;
}

export default function Dashboard() {
  const { isAuthenticated, user: authUser } = useAuth();
  const { data: profile, isLoading: profileLoading } = trpc.user.profile.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });
  const { data: submissions, isLoading: subsLoading } = trpc.submission.mySubmissions.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: proposals, isLoading: proposalsLoading } = trpc.proposal.myProposals.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">You need to sign in to view your dashboard</p>
          <a href="/login">
            <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))", color: "oklch(0.08 0.01 260)" }}>
              <LogIn size={14} />
              SIGN IN
            </button>
          </a>
        </div>
      </div>
    );
  }

  const xpProgress = profile
    ? profile.nextLevelXp > profile.currentLevelXp
      ? ((profile.xp - profile.currentLevelXp) / (profile.nextLevelXp - profile.currentLevelXp)) * 100
      : 100
    : 0;

  const approvedSubs = submissions?.filter((s) => s.submission.status === "approved") ?? [];
  const pendingSubs = submissions?.filter((s) => s.submission.status === "pending") ?? [];
  const rejectedSubs = submissions?.filter((s) => s.submission.status === "rejected") ?? [];
  const totalXpEarned = approvedSubs.reduce((sum, s) => sum + (s.submission.xpAwarded ?? 0), 0);

  return (
    <div className="min-h-screen py-8">
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-black tracking-wider mb-1">DASHBOARD</h1>
          <p className="text-muted-foreground text-sm">Your quest progress and achievements</p>
        </motion.div>

        {/* Profile Card */}
        {profileLoading ? (
          <div className="game-card p-6 animate-pulse mb-6">
            <div className="h-8 bg-muted rounded w-1/3 mb-4" />
            <div className="h-4 bg-muted rounded w-full mb-2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        ) : profile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="game-card p-6 mb-6"
            style={{ borderColor: "oklch(0.72 0.22 165 / 0.3)", boxShadow: "0 0 24px oklch(0.72 0.22 165 / 0.08)" }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.72 0.22 165 / 0.2), oklch(0.65 0.25 290 / 0.2))",
                    border: "2px solid oklch(0.72 0.22 165 / 0.4)",
                    color: "oklch(0.72 0.22 165)",
                    fontFamily: "Orbitron, monospace",
                  }}
                >
                  {(profile.name ?? "?")[0]?.toUpperCase()}
                </div>
                <div
                  className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                    color: "oklch(0.08 0.01 260)",
                    fontFamily: "Orbitron, monospace",
                  }}
                >
                  {profile.level}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-black">{profile.name ?? "Adventurer"}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "oklch(0.65 0.25 290 / 0.15)", color: "oklch(0.65 0.25 290)", border: "1px solid oklch(0.65 0.25 290 / 0.3)" }}>
                    {getLevelTitle(profile.level ?? 1)}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Level {profile.level} · {profile.xp?.toLocaleString()} XP total
                </p>

                {/* XP Bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Level {profile.level}</span>
                    <span>{profile.xp - profile.currentLevelXp} / {profile.nextLevelXp - profile.currentLevelXp} XP</span>
                    <span>Level {(profile.level ?? 1) + 1}</span>
                  </div>
                  <div className="xp-bar h-3">
                    <motion.div
                      className="xp-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, xpProgress)}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5 text-right">
                    {Math.round(xpProgress)}% to Level {(profile.level ?? 1) + 1}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        >
          {[
            { label: "QUESTS DONE", value: approvedSubs.length, icon: <Trophy size={18} />, color: "oklch(0.72 0.22 165)" },
            { label: "XP EARNED", value: `${totalXpEarned.toLocaleString()}`, icon: <Zap size={18} />, color: "oklch(0.65 0.22 240)" },
            { label: "PENDING", value: pendingSubs.length, icon: <Clock size={18} />, color: "oklch(0.72 0.22 50)" },
            { label: "CURRENT LEVEL", value: profile?.level ?? 1, icon: <Crown size={18} />, color: "oklch(0.78 0.18 80)" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.07 }}
              className="game-card p-4 text-center"
            >
              <div className="flex items-center justify-center mb-2" style={{ color: stat.color }}>
                {stat.icon}
              </div>
              <div className="text-2xl font-black mb-1" style={{ fontFamily: "Orbitron, monospace", color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Proposals Section */}
        {proposals && proposals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black tracking-wider">QUEST PROPOSALS</h2>
              <Link href="/create-quest">
                <button className="btn-game px-4 py-1.5 text-xs">
                  <Plus size={12} />
                  NEW PROPOSAL
                </button>
              </Link>
            </div>

            {proposalsLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="game-card p-4 animate-pulse flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {proposals.map((proposal, i) => {
                  const statusColor = proposal.status === "approved"
                    ? "oklch(0.72 0.22 165)"
                    : proposal.status === "rejected"
                    ? "oklch(0.65 0.25 25)"
                    : "oklch(0.72 0.22 50)";

                  return (
                    <motion.div
                      key={proposal.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="game-card p-4 flex items-center gap-4"
                    >
                      {/* Icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}
                      >
                        {proposal.status === "approved" ? (
                          <CheckCircle size={20} style={{ color: statusColor }} />
                        ) : proposal.status === "rejected" ? (
                          <XCircle size={20} style={{ color: statusColor }} />
                        ) : (
                          <Clock size={20} style={{ color: statusColor }} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm truncate">{proposal.title}</span>
                          <span className={`badge-${proposal.difficulty}`}>
                            {proposal.difficulty.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                          {proposal.description}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={proposal.status} />
                          {proposal.duration != null && (
                            <span className="text-xs text-muted-foreground">
                              TIME LIMIT {getProposalDurationLabel(proposal.duration)}
                            </span>
                          )}
                          {proposal.rejectionReason && (
                            <span className="text-xs text-destructive" title={proposal.rejectionReason}>
                              {proposal.rejectionReason.substring(0, 30)}...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* XP */}
                      <div
                        className="text-sm font-black flex-shrink-0"
                        style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}
                      >
                        +{proposal.xpReward} XP
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Submissions History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: proposals && proposals.length > 0 ? 0.4 : 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black tracking-wider">QUEST HISTORY</h2>
            <Link href="/quests">
              <button className="btn-game px-4 py-1.5 text-xs">
                <Swords size={12} />
                FIND QUESTS
              </button>
            </Link>
          </div>

          {subsLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="game-card p-4 animate-pulse flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !submissions || submissions.length === 0 ? (
            <div className="text-center py-16 game-card">
              <Swords size={40} className="mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold text-muted-foreground mb-2">No Quests Yet</h3>
              <p className="text-sm text-muted-foreground/60 mb-6">Start your adventure by completing your first quest</p>
              <Link href="/quests">
                <button className="btn-game px-5 py-2 text-sm">
                  <Swords size={14} />
                  BROWSE QUESTS
                </button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {submissions.map((row, i) => (
                <motion.div
                  key={row.submission.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="game-card p-4 flex items-center gap-4"
                >
                  {/* Media preview */}
                  <div
                    className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center"
                    style={{ border: "1px solid oklch(0.2 0.02 260)" }}
                  >
                    {row.submission.mediaType === "image" ? (
                      <img
                        src={row.submission.mediaUrl}
                        alt="Proof"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={row.submission.mediaUrl}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm truncate">
                        {row.quest?.title ?? "Unknown Quest"}
                      </span>
                      {row.quest?.difficulty && (
                        <span className={`badge-${row.quest.difficulty}`}>
                          {row.quest.difficulty.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={row.submission.status} />
                      {row.submission.aiConfidence != null && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(row.submission.aiConfidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    {row.submission.aiReason && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {row.submission.aiReason}
                      </p>
                    )}
                  </div>

                  {/* XP */}
                  {row.submission.xpAwarded > 0 && (
                    <div
                      className="text-sm font-black flex-shrink-0"
                      style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}
                    >
                      +{row.submission.xpAwarded} XP
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
