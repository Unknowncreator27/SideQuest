import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Crown,
  Shield,
  Swords,
  Trophy,
  Upload,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

const FEATURES = [
  {
    icon: <Swords size={24} />,
    title: "Epic Side Quests",
    desc: "Take on real-world challenges with your crew. From easy tasks to legendary feats.",
    color: "oklch(0.72 0.22 165)",
  },
  {
    icon: <Upload size={24} />,
    title: "Prove Your Worth",
    desc: "Upload photo or video proof of your quest completion. No cheating allowed.",
    color: "oklch(0.65 0.22 240)",
  },
  {
    icon: <Brain size={24} />,
    title: "AI Verification",
    desc: "Our AI reviews your submission and verifies authenticity before awarding XP.",
    color: "oklch(0.65 0.25 290)",
  },
  {
    icon: <Zap size={24} />,
    title: "Earn XP & Level Up",
    desc: "Complete quests to earn experience points and climb through the ranks.",
    color: "oklch(0.72 0.22 50)",
  },
  {
    icon: <Crown size={24} />,
    title: "Leaderboard Glory",
    desc: "Compete with your squad. Rise to the top and claim your throne.",
    color: "oklch(0.78 0.18 80)",
  },
  {
    icon: <Shield size={24} />,
    title: "Time-Bound Challenges",
    desc: "Some quests expire — act fast or miss your chance at glory.",
    color: "oklch(0.65 0.25 25)",
  },
];

const DIFFICULTY_COLORS = {
  easy: "oklch(0.72 0.22 165)",
  medium: "oklch(0.72 0.22 50)",
  hard: "oklch(0.65 0.25 25)",
  legendary: "oklch(0.65 0.25 290)",
};

function FloatingParticle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-primary/40"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{
        y: [0, -30, 0],
        x: [0, 10, 0],
        opacity: [0.3, 0.8, 0.3],
        scale: [1, 1.5, 1],
      }}
      transition={{
        duration: 4 + delay,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: leaderboard } = trpc.user.leaderboard.useQuery();
  const { data: quests } = trpc.quest.list.useQuery({ status: "active" });
  const { data: activity } = trpc.activity.global.useQuery({ limit: 6 });

  const particles = Array.from({ length: 20 }, (_, i) => ({
    delay: i * 0.3,
    x: (i * 17 + 5) % 95,
    y: (i * 23 + 10) % 85,
  }));

  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center grid-bg">
        {/* Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((p, i) => (
            <FloatingParticle key={i} {...p} />
          ))}
          {/* Glow orbs */}
          <div
            className="absolute w-96 h-96 rounded-full blur-3xl opacity-10"
            style={{
              background: "oklch(0.72 0.22 165)",
              top: "10%",
              left: "5%",
            }}
          />
          <div
            className="absolute w-80 h-80 rounded-full blur-3xl opacity-8"
            style={{
              background: "oklch(0.65 0.25 290)",
              bottom: "10%",
              right: "5%",
            }}
          />
        </div>

        <div className="container relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-widest mb-6">
                <Zap size={12} />
                GAMIFIED REAL-WORLD CHALLENGES
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-6xl sm:text-7xl md:text-8xl font-black leading-none mb-6"
              style={{ fontFamily: "Orbitron, monospace" }}
            >
              <span
                style={{
                  background: "linear-gradient(135deg, oklch(0.72 0.22 165) 0%, oklch(0.65 0.22 240) 50%, oklch(0.65 0.25 290) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                SIDE
              </span>
              <br />
              <span className="text-foreground">QUEST</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-8 max-w-xl leading-relaxed"
            >
              Complete real-world challenges with your crew. Upload proof, get AI-verified, and earn XP. Rise through the ranks and claim legendary status.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-3"
            >
              {isAuthenticated ? (
                <>
                  <Link href="/quests">
                    <button
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-wider transition-all duration-200"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                        color: "oklch(0.08 0.01 260)",
                        boxShadow: "0 0 20px oklch(0.72 0.22 165 / 0.4)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 30px oklch(0.72 0.22 165 / 0.6)";
                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px oklch(0.72 0.22 165 / 0.4)";
                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                      }}
                    >
                      <Swords size={16} />
                      BROWSE QUESTS
                      <ArrowRight size={14} />
                    </button>
                  </Link>
                  <Link href="/dashboard">
                    <button className="btn-game px-6 py-3 text-sm tracking-wider">
                      MY DASHBOARD
                    </button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <button
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-wider transition-all duration-200"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                        color: "oklch(0.08 0.01 260)",
                        boxShadow: "0 0 20px oklch(0.72 0.22 165 / 0.4)",
                      }}
                    >
                      <Zap size={16} />
                      START YOUR QUEST
                      <ArrowRight size={14} />
                    </button>
                  </Link>
                  <Link href="/quests">
                    <button className="btn-game px-6 py-3 text-sm tracking-wider">
                      VIEW QUESTS
                    </button>
                  </Link>
                </>
              )}
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="flex gap-6 mt-12"
            >
              {[
                { label: "ACTIVE QUESTS", value: quests?.filter(q => q.quest.status === "active").length ?? 0 },
                { label: "ADVENTURERS", value: leaderboard?.length ?? 0 },
                { label: "DIFFICULTIES", value: 4 },
              ].map((stat) => (
                <div key={stat.label}>
                  <div
                    className="text-2xl font-black"
                    style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground tracking-widest">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Activity Feed Section */}
      <section className="py-12 relative overflow-hidden">
        <div className="container">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Activity Feed */}
            <div className="flex-1 w-full">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex items-center gap-3 mb-8"
              >
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <Zap size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-wider uppercase" style={{ fontFamily: "Orbitron, monospace" }}>
                    Live Activity
                  </h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Recent wins from the community</p>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {activity?.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="game-card overflow-hidden flex flex-col group hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]"
                  >
                    {/* Post Header */}
                    <div className="p-4 flex items-center gap-3 border-b border-white/5">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 border border-primary/30 flex items-center justify-center">
                        {item.userAvatar ? (
                          <img src={item.userAvatar} alt={item.userName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-primary">{item.userName?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-primary tracking-wider truncate" style={{ fontFamily: "Orbitron, monospace" }}>
                          {item.userName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="opacity-50">
                        {item.type === "quest_completion" ? (
                          <Swords size={14} className="text-primary" />
                        ) : item.type === "level_up" ? (
                          <Zap size={14} className="text-yellow-400" />
                        ) : (
                          <Trophy size={14} className="text-purple-400" />
                        )}
                      </div>
                    </div>

                    {/* Post Content (Media) */}
                    {item.mediaUrl && !item.mediaUrl.startsWith("pending-review://") ? (
                      <div className="aspect-square relative overflow-hidden bg-black/40">
                        {item.mediaType === "video" ? (
                          <video src={item.mediaUrl} className="w-full h-full object-cover" muted loop onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => e.currentTarget.pause()} />
                        ) : (
                          <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    ) : (
                      <div className="aspect-square flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-primary/5 to-purple-500/5 border-b border-white/5">
                         <div className="p-4 rounded-full bg-primary/10 mb-4">
                           {item.type === "level_up" ? <Zap size={32} className="text-yellow-400" /> : <Trophy size={32} className="text-purple-400" />}
                         </div>
                         <div className="text-sm font-black uppercase tracking-widest mb-2">{item.type.replace('_', ' ')}</div>
                         <div className="text-xs text-muted-foreground leading-relaxed">{item.detail}</div>
                      </div>
                    )}

                    {/* Post Footer */}
                    <div className="p-4">
                      <h3 className="text-sm font-bold leading-tight mb-1 group-hover:text-primary transition-colors">{item.title}</h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{item.detail}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Quick Stats Sidebar */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="w-full lg:w-80"
            >
              <div className="game-card p-6 border-primary/20 bg-primary/5">
                <h3 className="text-sm font-black mb-4 tracking-widest uppercase text-primary" style={{ fontFamily: "Orbitron, monospace" }}>
                  World Status
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-primary/10">
                    <span className="text-xs text-muted-foreground">Active Quests</span>
                    <span className="text-sm font-bold">{quests?.filter(q => q.quest.status === "active").length ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-primary/10">
                    <span className="text-xs text-muted-foreground">Total Heroes</span>
                    <span className="text-sm font-bold">{leaderboard?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-primary/10">
                    <span className="text-xs text-muted-foreground">Level Cap</span>
                    <span className="text-sm font-bold text-yellow-400">99</span>
                  </div>
                </div>
                <Link href="/quests">
                  <button className="w-full mt-6 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors uppercase tracking-widest">
                    Join the Fray
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black tracking-wider mb-4">HOW IT WORKS</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A fully gamified experience for you and your squad. Complete quests, earn XP, and dominate the leaderboard.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="game-card p-6"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `${feature.color}20`,
                    border: `1px solid ${feature.color}40`,
                    color: feature.color,
                  }}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Players Preview */}
      {leaderboard && leaderboard.length > 0 && (
        <section className="py-16 relative">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="container relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-black tracking-wider mb-4">TOP ADVENTURERS</h2>
              <p className="text-muted-foreground">The legends who dominate the leaderboard</p>
            </motion.div>

            <div className="flex flex-col gap-3 max-w-lg mx-auto">
              {leaderboard.slice(0, 3).map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="game-card p-4 flex items-center gap-4"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black"
                    style={{
                      background: i === 0
                        ? "oklch(0.78 0.18 80 / 0.2)"
                        : i === 1
                        ? "oklch(0.7 0.01 260 / 0.2)"
                        : "oklch(0.72 0.22 50 / 0.2)",
                      border: `2px solid ${i === 0 ? "oklch(0.78 0.18 80)" : i === 1 ? "oklch(0.7 0.01 260)" : "oklch(0.72 0.22 50)"}`,
                      color: i === 0 ? "oklch(0.78 0.18 80)" : i === 1 ? "oklch(0.7 0.01 260)" : "oklch(0.72 0.22 50)",
                      fontFamily: "Orbitron, monospace",
                    }}
                  >
                    {i === 0 ? "👑" : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{player.name ?? "Anonymous"}</div>
                    <div className="text-xs text-muted-foreground">Level {player.level}</div>
                  </div>
                  <div
                    className="text-sm font-black"
                    style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}
                  >
                    {player.xp?.toLocaleString()} XP
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link href="/leaderboard">
                <button className="btn-game px-6 py-2.5 text-sm tracking-wider">
                  VIEW FULL LEADERBOARD
                  <ArrowRight size={14} />
                </button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden p-12 text-center"
            style={{
              background: "linear-gradient(135deg, oklch(0.72 0.22 165 / 0.08), oklch(0.65 0.25 290 / 0.08))",
              border: "1px solid oklch(0.72 0.22 165 / 0.2)",
            }}
          >
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: "linear-gradient(oklch(0.72 0.22 165) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.22 165) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative z-10">
              <Trophy size={48} className="mx-auto mb-6 text-primary" />
              <h2 className="text-4xl font-black tracking-wider mb-4">READY TO BEGIN?</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Join your crew, take on side quests, and prove you have what it takes to reach legendary status.
              </p>
              {!isAuthenticated ? (
                <a href="/login">
                  <button
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm tracking-wider"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                      color: "oklch(0.08 0.01 260)",
                      boxShadow: "0 0 24px oklch(0.72 0.22 165 / 0.4)",
                    }}
                  >
                    <Zap size={16} />
                    JOIN THE QUEST
                  </button>
                </a>
              ) : (
                <Link href="/quests">
                  <button
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm tracking-wider"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                      color: "oklch(0.08 0.01 260)",
                      boxShadow: "0 0 24px oklch(0.72 0.22 165 / 0.4)",
                    }}
                  >
                    <Swords size={16} />
                    BROWSE QUESTS
                  </button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
